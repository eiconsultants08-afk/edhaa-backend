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


export async function checkProjectUser(username, password) {
  // Check if username and password are provided
  if (!username || !password) {
    return {
      status: 400,
      message: "Username or password is missing."
    };
  }
  // Check if the user exists
  const user = await getUserByUsername(username);

  // If the user does not exist, return 404
  if (!user) {
    return {
      status: 404,
      message: `User ${username} not found.`
    }
  }

  // Check if the password is correct
  const isUser = await checkPassword(password, user.password);

  // If the password is incorrect, return 400
  if (!isUser) {
    return {
      status: 400,
      message: "Wrong password. Please provide correct password."
    };
  } else {
    return {
      status: 200,
      message: "User authenticated successfully."
    };
  }
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

export async function projectDirectory(project, org, predictionType, projectName, year, month) {
  const now = getCurrenTime(); // Get the current time

  // Helper function to generate a directory path
  const generateDirectory = (date) => {
    const year = date.format('YYYY');
    const month = date.format('MM');
    const day = date.format('DD');
    return `${org}_data/${predictionType}/${projectName}/${year}/${month}/${day}`;
  };

  const currentDayDirectory = generateDirectory(now);
  const previousDayDirectory = generateDirectory(now.clone().subtract(1, 'day'));
  const nextDayDirectory = generateDirectory(now.clone().add(1, 'day'));

  let directories = [];

  if (predictionType === 'intraday') {
    if (now.hour() >= 22) {
      const filesExist = await checkIfFilesExist(`${project}-project`, nextDayDirectory);
      if (filesExist) {
        directories.push(nextDayDirectory);
      }
    }
    directories.push(currentDayDirectory, previousDayDirectory);
  } else if (predictionType === 'day_ahead') {
    directories.push(`${org}_data/${predictionType}/${projectName}/${year}/${month}`);
  }

  return directories;
}

// GETTING FILES 
async function fetchFilesFromDirectory(project, directory) {
  const params = {
    Bucket: `${project}-project`,
    Prefix: directory
  };
  const command = new ListObjectsV2Command(params);
  const folder = await s3Client.send(command);

  // Map the files to include both the key and last modified timestamp
  return folder.Contents.map(item => ({
    fileName: item.Key.substring(item.Key.lastIndexOf('/') + 1),
    lastModified: item.LastModified // Include the last modified timestamp
  }));
}

export async function getProjectFileName(project, org, predictionType, projectName, year, month) {
  try {
    const directories = await projectDirectory(project, org, predictionType, projectName, year, month);
    let fileData = [];

    // Iterate through directories and fetch files with metadata
    for (const directory of directories) {
      const filesInDirectory = await fetchFilesFromDirectory(project, directory);

      const filesWithDirectory = filesInDirectory.map(({ fileName, lastModified }) => ({
        directory,
        fileName,
        lastModified,
      }));

      fileData = [...fileData, ...filesWithDirectory];
    }

    // Sort files by last modified timestamp in descending order
    fileData.sort((a, b) => b.lastModified - a.lastModified);

    return {
      projects: project,
      organization: org,
      type: predictionType,
      location: projectName,
      file: fileData.map(({ directory, fileName }) => ({ directory, fileName })) // Include directory and file name
    };
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    } else {
      console.log("Error occurred while fetching files:", error);
    }
  }
}

export async function getLastProjectFiles(project, org, predictionType, projectName, year, month, domain, autoAdjust = true) {
  const now = getCurrenTime();

  let targetYear = year;
  let targetMonth = month;
  
  // ✅ Only auto-adjust if the flag is true AND today is the 1st
  // If year/month are explicitly provided and different from current, skip auto-adjust
  const currentYear = now.format('YYYY');
  const currentMonth = now.format('MM');
  const isManualSelection = (year !== currentYear || month !== currentMonth);
  
  if (autoAdjust && now.date() === 1 && !isManualSelection) {
    const previous = now.clone().subtract(1, 'month');
    targetMonth = previous.format('MM');
    targetYear = previous.format('YYYY');
    console.log(`🔄 First day detected! Auto-switching to previous month: ${targetYear}-${targetMonth}`);
  } else if (isManualSelection) {
    console.log(`📅 Manual month selected: ${targetYear}-${targetMonth}`);
  }

  // ✅ Build base directory with correct month/year
  const baseDirectory = `${org}_data/${predictionType}/${projectName}/${targetYear}/${targetMonth}`;
  console.log('\n\nBase Directory:', baseDirectory);

  let fileNames = [];
  let directories = [];

  if (predictionType === 'intraday') {
    const { allFiles, directories: dirs } = await fetchLastFileFromDirectory(project, baseDirectory, domain);
    fileNames = allFiles;
    directories = dirs;
  }

  // ✅ Keep old return structure
  const filesWithDirectory = fileNames.map((fileName, index) => ({
    directory: directories[index],
    fileName,
  }));

  const sortedFilesWithDirectory = [...filesWithDirectory].sort(
    ({ fileName: a }, { fileName: b }) => b.localeCompare(a)
  );

  return {
    projects: project,
    organization: org,
    type: predictionType,
    location: projectName,
    file: sortedFilesWithDirectory,
  };
}

async function fetchLastFileFromDirectory(project, directory, domain) {
  const params = {
    Bucket: `${project}-project`,
    Prefix: directory.endsWith('/') ? directory : `${directory}/`,
  };

  let isTruncated = true;
  let continuationToken = null;
  let allFiles = [];
  let directories = [];

  while (isTruncated) {
    if (continuationToken) params.ContinuationToken = continuationToken;

    const command = new ListObjectsV2Command(params);
    const response = await s3Client.send(command);

    const files = (response.Contents || [])
      .filter(item => item.Key.endsWith(`${constants.LAST_FILE_TIME[domain]}.csv`))
      .map(item => ({
        path: item.Key.substring(item.Key.lastIndexOf('/') + 1),
        directory: item.Key.substring(0, item.Key.lastIndexOf('/'))
      }));

    allFiles.push(...files.map(f => f.path));
    directories.push(...files.map(f => f.directory));

    isTruncated = response.IsTruncated;
    continuationToken = response.NextContinuationToken;
  }

  return { allFiles, directories };
}




// DOWNLOAD FILES 
export async function getProjectFileDownload(project, org, predictionType, projectName, fileName, directory) {
  try {

    const params = {
      Bucket: `${project}-project`,
      Key: `${directory}/${fileName}`
    };

    try {
      // Try to get the file from the current directory
      const command = new GetObjectCommand(params);
      const { Body } = await s3Client.send(command);
      const data = await new Promise((resolve, reject) => {
        const results = [];
        Body.pipe(csvParser())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (error) => reject(error));
      });
      return data;
    } catch (error) {
      // If the file is not found in the current directory, continue to the next one
      if (error.name !== 'NotFound') {
        console.log("Error occurred while fetching file:", error);
        return;
      }
    }

  } catch (error) {
    console.log("Error occurred:", error);
    return false;
  }
}

// VALIDATION FOR E-USERS ADANI
export async function euserValidation(username, password) {

  try {
    const userValidate = await getUserByUsername(username);
    const passwordValidate = await checkPassword(password, userValidate.password);

    if (userValidate && passwordValidate) {
      return userValidate;
    } else {
      return false;
    }
  } catch (error) {
    console.error(`Failed to get Energy Users email: ${error.message}`);
    throw error;
  }

}

export function aggregateCalculation(predictedData, actualData, energyDetails) {
  const { ppa, turbine_count, turbine_rating, farm_rating } = energyDetails

  //Total capacity in KW hour
  const tc_tw = farm_rating * 1000 / 4;
  const aggregrateData = new Array(actualData.length);
  // console.log('\n\n\n\n',actualData.length, 'final',predictedData.length);

  for (let i = 0; i < actualData.length; i++) {
    // console.log(predictedData[i],i, actualData[i],i);

    const farm_level_active_power_kw = parseFloat(((predictedData[i]["Farm Level Active Power (MW)"] * 1000) / 4).toFixed(2));
    const kw_sum = parseFloat(Math.max(actualData[i]["KW_sum"] / 4, 0).toFixed(2));
    const error = parseFloat((((kw_sum - farm_level_active_power_kw) / tc_tw) * 100).toFixed(2));
    const total_deviated_unit = parseFloat((Math.abs(kw_sum - farm_level_active_power_kw)).toFixed(2));

    // constants 
    const unit_15 = (15 / 100) * tc_tw;
    const temp_unit_15_20 = (5 / 100) * tc_tw;

    const unit_lt_15 = Math.min(total_deviated_unit, unit_15)
    const unit_15_20 = Math.max(0, Math.min(total_deviated_unit - unit_lt_15, temp_unit_15_20));
    const unit_gt_20 = Math.max(total_deviated_unit - unit_lt_15 - unit_15_20, 0);


    let injection_type = null;

    if (error <= -15 && error < 0) {
      injection_type = 'Under Injection';
    } else if (error >= 15 && error > 0) {
      injection_type = 'Over Injection';
    }

    let DSM_10 = 0;
    let RL_10 = 0;
    let DSM_100 = 0;
    let RL_100 = 0;

    if (error < 0) {
      // error(-) DSM  
      DSM_10 = parseFloat((unit_15_20 * ppa / 10).toFixed(2));
      DSM_100 = parseFloat((unit_gt_20 * ppa).toFixed(2));
    } else if (error > 0) {
      // error(+) RL  
      RL_10 = parseFloat((unit_15_20 * ppa / 10).toFixed(2));
      RL_100 = parseFloat((unit_gt_20 * ppa).toFixed(2));
    }

    const total_loss_in_rs = parseFloat((DSM_10 + RL_10 + DSM_100 + RL_100).toFixed(2));

    aggregrateData[i] = { kw_sum, farm_level_active_power_kw, error, total_deviated_unit, unit_lt_15, unit_15_20, unit_gt_20, injection_type, DSM_10, RL_10, DSM_100, RL_100, total_loss_in_rs };
  }

  return aggregrateData;
}


export function dailyAggregationCalculation(aggregateData) {

  let total_generation = 0, total_loss = 0, total_DSM = 0, total_RL = 0, total_flap_kw = 0;

  for (const { kw_sum, total_loss_in_rs, DSM_10, DSM_100, RL_10, RL_100, farm_level_active_power_kw } of aggregateData) {
    total_generation += kw_sum;
    total_loss += +total_loss_in_rs;
    total_DSM += DSM_10 + DSM_100;
    total_RL += RL_10 + RL_100;
    total_flap_kw += farm_level_active_power_kw;
  }

  total_loss = parseFloat((total_loss).toFixed(2));
  total_DSM = parseFloat((total_DSM).toFixed(2));
  total_RL = parseFloat((total_RL).toFixed(2));
  total_flap_kw = parseFloat((total_flap_kw / 1000).toFixed(2));

  let total_impact = parseFloat((total_loss * 100 / total_generation).toFixed(2));
  total_generation = parseFloat((total_generation / 1000).toFixed(2));

  return { total_loss, total_generation, total_impact, total_DSM, total_RL, total_flap_kw }
}

export async function getS3JsonData(Bucket, Key) {
  const params = { Bucket, Key }
  const response = await s3Client.send(new GetObjectCommand(params));
  const responseInString = await response.Body.transformToString();

  return JSON.parse(responseInString);
}

// FETCH PDF FROM S3 
export async function fetchPdfFromS3(bucketName, objectKey, res) {
  const params = {
    Bucket: bucketName,
    Key: objectKey,
  };

  const command = new GetObjectCommand(params);
  const response = await s3Client.send(command);

  // Convert the readable stream to a buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  const pdfBuffer = Buffer.concat(chunks);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="rainfall_report.pdf"');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');

  const base64Pdf = pdfBuffer.toString('base64');
  const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

  console.log(`PDF file successfully fetched from bucket '${bucketName}' with key '${objectKey}'`);

  return dataUrl;
}


export function print(message, value) {
  console.log('\n\n\n\n\n\n', (message || 'MESSAGE'), (value || ''));
}

export async function readS3File(objectKey, bucketName) {
  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
    const { Body } = await s3Client.send(command);

    // Detect file type by extension
    if (objectKey.endsWith(".csv")) {
      return await new Promise((resolve, reject) => {
        const results = [];
        Body.pipe(csvParser())
          .on("data", (row) => results.push(row))
          .on("end", () => resolve(results))
          .on("error", (error) => reject(error));
      });
    } else if (objectKey.endsWith(".json")) {
      const stream = await Body.transformToString();
      return JSON.parse(stream);
    } else {
      throw new Error(`Unsupported file type for: ${objectKey}`);
    }
  } catch (error) {
    console.error("Error reading file from S3:", error);
    throw error;
  }
}
