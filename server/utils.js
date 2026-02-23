import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import moment from "moment-timezone";
import { parse } from 'json2csv';
import { config, constants, environment } from "./constants.js";
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { SESClient } from "@aws-sdk/client-ses";
import { getUserByUsername } from './database/db.js';
import csvParser from 'csv-parser';
import crypto from 'crypto';
const secrets = config.jwt;
const s3Client = new S3Client({ region: 'ap-south-1' })
export const sesClient = new SESClient({ region: 'ap-south-1' });

export function getToken(payload, type, expiresIn) {
  return jwt.sign(payload, secrets[type], {
    expiresIn: expiresIn,
  });
}

export function checkToken(token, type) {
  return jwt.verify(token, secrets[type]);
}

export function checkExpiresIn(expiry, expiresIn) {
  const expiryMoment = moment(expiry * 1000);
  const currentMoment = moment();
  const daysDifference = expiryMoment.diff(currentMoment, "days");
  return daysDifference <= expiresIn && daysDifference >= 0;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, constants.SALT_ROUNDS);
}

export async function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function getPaginationInfo(rows, page) {
  const limit = Math.min(Number(rows), constants.PER_PAGE_ROWS_MAX);
  let offset = 0;
  const pageNumber = Number(page);
  if (page && !isNaN(page) && pageNumber > 1) {
    offset = (pageNumber - 1) * limit;
  }
  return {
    limit,
    offset,
  };
}

export function getDates(dataTime, sd = null, ed = null) {
  const currentDay = new Date();
  let endDate = currentDay;
  let startDate = new Date(endDate);

  if (dataTime === "live") {
    startDate.setDate(startDate.getDate() - constants.MAX_LIVE_DATA);
  } else if (dataTime === "historic") {
    if (sd && ed) {
      startDate = new Date(sd);
      endDate = new Date(ed);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      startDate.setDate(
        startDate.getDate() - constants.MAX_DAY_USER_HISTORIC_DATA
      );
    }
  }
  return { startDate, endDate };
}

export function formatData(data, config) {
  data.forEach((record, index) => {
    let row = {
      ...record.toJSON(),
    };
    config.forEach((field) => {
      const obj = row[field];
      if (obj) {
        Object.keys(obj).forEach((key) => {
          row[key] = obj[key];
        });
        delete row[field];
      }
    });
    data[index] = row;
  });
}

export function updateData(newData, oldData, attributes) {
  let data = {};
  attributes.forEach((attr) => {
    // SQL inject attack avoiding
    if (newData[attr] && newData[attr] !== oldData[attr]) {
      data[attr] = newData[attr];
    }
  });
  return data;
}

export function addData(raw, attributes) {
  let data = {};
  attributes.forEach((attr) => {
    // SQL inject attack avoiding
    if (attr in raw) {
      data[attr] = raw[attr];
    }
  });
  return data;
}

//IST FOR TESTING AND UTC WHILE DEPLOYING
export function getCurrenTime() {
  return moment().tz("Asia/Kolkata");
}

export function nearestHour() {

  const now = getCurrenTime();

  const currentHour = now.hours();

  const hourList = [0, 3, 6, 9, 12, 15, 18, 21];

  // Find the nearest hour less than the current hour
  let nearestHour = hourList[0];

  hourList.forEach((hour) => {
    if (hour <= currentHour) {
      nearestHour = hour;
    }
  });

  now.hours(nearestHour);
  return now;
}

export function extractDateTime(dateString) {
  const dateTimeObject = new Date(dateString);
  const dateTimeMoment = moment(dateTimeObject);
  let dateTimeDict = {}

  // Always extract date components
  dateTimeDict['Date'] = dateTimeMoment.format('DD-MM-YYYY');
  dateTimeDict['Year'] = dateTimeMoment.year();
  dateTimeDict['Month'] = (dateTimeMoment.month() + 1).toString().padStart(2, '0');
  dateTimeDict['Day'] = dateTimeMoment.date().toString().padStart(2, '0');

  // Check if the original string contains time information
  const hasTime = dateString.includes(':') ||
    dateString.toLowerCase().includes('am') ||
    dateString.toLowerCase().includes('pm') ||
    dateString.includes('T') || // ISO format with time
    /\d{1,2}:\d{2}/.test(dateString); // HH:MM format

  // Only extract time components if time is present in the input
  if (hasTime) {
    dateTimeDict['Hour'] = dateTimeMoment.hour().toString().padStart(2, '0');
    dateTimeDict['Minute'] = dateTimeMoment.minute().toString().padStart(2, '0');
    dateTimeDict['hasTime'] = true;
  } else {
    dateTimeDict['hasTime'] = false;
  }

  return dateTimeDict;

}


export async function checkFilePresent(directory, bucket) {
  try {
    const params = {
      Bucket: bucket,
      Key: directory
    }

    const command = new HeadObjectCommand(params)
    const response = await s3Client.send(command)
    return response

  } catch (error) {
    if (error.name === 'NotFound') {
      return false
    } else {
      console.log("Error occurred:", error);
    }
  }
}

export async function readCsvFile(objectKey, bucketName) {
  try {
    const params = {
      Bucket: bucketName,
      Key: objectKey,
    };
    const command = new GetObjectCommand(params);
    const { Body } = await s3Client.send(command);

    const data = await new Promise((resolve, reject) => {
      const results = [];
      Body.pipe(csvParser())
        .on('data', (row) => results.push(row)) // Push each parsed row into results
        .on('end', () => resolve(results)) // Resolve promise when parsing completes
        .on('error', (error) => reject(error)); // Reject promise if an error occurs
    });

    return data;

  } catch (error) {
    console.error("Error occurred while reading CSV file:", error, objectKey);
    throw error;
  }
}

export function isValidCSVData(fileContents) {
  try {
    // if the content of data is not in string then return false
    if (typeof (fileContents) !== 'string') {
      return false
    }

    // Split the file contents into lines
    let lines = fileContents.split("\n");

    // Check if the last element is empty
    if (lines[lines.length - 1] === "") {
      // Remove the last element
      lines.pop();
    }

    // Check if each line has the same number of columns
    const firstLineColumns = lines[0].split(",").length;
    return lines.every((line) => line.split(",").length === firstLineColumns);
  } catch (error) {
    // If parsing fails (throws an error), return false
    console.error(error);
    return false;
  }
}



export async function uploadCSVData(objectKey, bucketName, jsonData) {
  try {
    let csvData;

    // Check if the input is an array or a single object
    if (Array.isArray(jsonData)) {
      // Input is an array of JSON objects
      csvData = parse(jsonData);
    } else if (typeof jsonData === "object" && jsonData !== null) {
      // Input is a single JSON object
      csvData = parse([jsonData]); // Wrap the single object in an array
    } else {
      throw new Error("Invalid JSON data. Must be an object or an array of objects.");
    }

    const params = {
      Bucket: bucketName,
      Key: objectKey,
      Body: csvData,
      ContentType: "text/csv",
    };

    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);

    console.log(
      `CSV file uploaded successfully to bucket '${bucketName}' with key '${objectKey}'.`
    );
    return response;
  } catch (error) {
    console.error("Error occurred while uploading CSV file:", error);
    return false;
  }
}

export function failureResponse(res, status, message) {
  return res.status(status).send({ status, message });
}

// Function to check if all required keys are present in the data
export function checkRequiredKeys(data, requiredKeys) {
  for (let key of requiredKeys) {
    if (!(key in data) || (data[key] === "")) {
      return false;
    }
  }
  return true
}

// Function to send response
export function sendResponse(res, status, message, data = null) {
  return res.status(status).json({
    message,
    data,
  });
}

export const encrypt = (plainText, workingKey) => {
  const m = crypto.createHash('md5');
  m.update(workingKey);
  const key = m.digest();
  const iv = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  let encoded = cipher.update(plainText, 'utf8', 'hex');
  encoded += cipher.final('hex');
  return encoded;
};

export const decrypt = (encText, workingKey) => {
  const m = crypto.createHash('md5');
  m.update(workingKey);
  const key = m.digest();
  const iv = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  let decoded = decipher.update(encText, 'hex', 'utf8');
  decoded += decipher.final('utf8');
  return decoded;
};

// PROJECTS  

// VALIDATION OF FILES 
export async function checkIfFilesExist(bucket, directory) {
  const params = {
    Bucket: bucket,
    Prefix: directory
  };

  const command = new ListObjectsV2Command(params);

  const folder = await s3Client.send(command);

  return folder.Contents && folder.Contents.length > 0 ? true : false;
}