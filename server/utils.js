import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import moment from "moment-timezone";
import { parse } from 'json2csv';
import { config, constants, environment } from "./constants.js";
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SESClient } from "@aws-sdk/client-ses";
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
export async function uploadBufferToS3(key, bucket, buffer, contentType) {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  };
  const command = new PutObjectCommand(params);
  return s3Client.send(command);
}

export async function getPresignedS3Url(key, bucket, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function checkIfFilesExist(bucket, directory) {
  const params = {
    Bucket: bucket,
    Prefix: directory
  };

  const command = new ListObjectsV2Command(params);

  const folder = await s3Client.send(command);

  return folder.Contents && folder.Contents.length > 0 ? true : false;
}

// ── Test results CSV builder ──────────────────────────────────────────────────
// Converts an array of TestHistory Sequelize instances (with nested patient,
// enteredBy, results → testType) into a CSV string (base64 encoded).

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function csvCalcAge(dob) {
  if (!dob) return "-";
  const b = new Date(dob);
  if (isNaN(b.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  ) age--;
  return age >= 0 ? String(age) : "-";
}

function csvFmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function csvStatusFor(r, gender) {
  if (r.value_text) return r.value_text;
  if (r.value_num == null) return "-";
  const v = Number(r.value_num);
  const tt = r.testType || {};
  const g = (gender || "").toUpperCase();
  const min =
    g === "MALE"   && tt.male_min   != null ? Number(tt.male_min)   :
    g === "FEMALE" && tt.female_min != null ? Number(tt.female_min) :
    tt.normal_min  != null ? Number(tt.normal_min) : null;
  const max =
    g === "MALE"   && tt.male_max   != null ? Number(tt.male_max)   :
    g === "FEMALE" && tt.female_max != null ? Number(tt.female_max) :
    tt.normal_max  != null ? Number(tt.normal_max) : null;
  if (min != null && max != null) return v < min ? "LOW" : v > max ? "HIGH" : "NORMAL";
  if (min == null && max != null) return v > max ? "HIGH" : "NORMAL";
  if (min != null && max == null) return v < min ? "LOW"  : "NORMAL";
  return "-";
}

function csvBioRef(tt, gender) {
  if (!tt) return "-";
  if (tt.reference_text) return tt.reference_text.split("\n")[0].trim();
  const g = (gender || "").toUpperCase();
  const unit = tt.unit || "";
  const min =
    g === "MALE"   && tt.male_min   != null ? Number(tt.male_min)   :
    g === "FEMALE" && tt.female_min != null ? Number(tt.female_min) :
    tt.normal_min  != null ? Number(tt.normal_min) : null;
  const max =
    g === "MALE"   && tt.male_max   != null ? Number(tt.male_max)   :
    g === "FEMALE" && tt.female_max != null ? Number(tt.female_max) :
    tt.normal_max  != null ? Number(tt.normal_max) : null;
  if (min != null && max != null) return `${min} - ${max}${unit ? " " + unit : ""}`;
  if (min == null && max != null) return `< ${max}${unit ? " " + unit : ""}`;
  if (min != null && max == null) return `> ${min}${unit ? " " + unit : ""}`;
  return "-";
}

export function buildTestResultsCsv(histories) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const HEADERS = [
    "Date", "Weekday", "Patient Name", "Patient ID", "Gender", "Age",
    "Performed By", "Role", "Device ID", "Session Notes",
    "Test Name", "Unit", "Category", "Method Used",
    "Value", "Status", "Biological Reference", "Critical Low", "Critical High",
  ];

  const rows = [HEADERS.map(q).join(",")];

  for (const h of histories) {
    const raw = h.get ? h.get({ plain: true }) : h;
    const d = new Date(raw.test_date);
    const dateStr  = csvFmtDate(raw.test_date);
    const weekday  = WEEKDAYS[d.getDay()];
    const patient  = raw.patient  || {};
    const enteredBy = raw.enteredBy || {};
    const patientCode = patient.patient_code != null
      ? String(patient.patient_code).padStart(5, "0") : "-";
    const gender = patient.gender || "-";
    const age    = csvCalcAge(patient.dob);
    const performer = enteredBy.name || enteredBy.username || "-";
    const role      = enteredBy.role || "-";
    const deviceId  = raw.device_id || "-";
    const notes     = (raw.notes || "").replace(/\n/g, " ");

    const results = raw.results || [];
    if (results.length === 0) {
      rows.push([dateStr, weekday, patient.name || "-", patientCode, gender, age,
        performer, role, deviceId, notes,
        "-", "-", "-", "-", "-", "-", "-", "-", "-"].map(q).join(","));
    } else {
      for (const r of results) {
        const tt   = r.testType || {};
        const name = tt.name   || "-";
        const unit = tt.unit   || "-";
        const cat  = tt.category || "-";
        const meth = r.method_used || "-";
        const val  = r.value_text ?? (r.value_num != null ? String(r.value_num) : "-");
        const status   = csvStatusFor(r, gender);
        const bioRef   = csvBioRef(tt, gender);
        const critLow  = tt.critical_low  != null ? String(tt.critical_low)  : "-";
        const critHigh = tt.critical_high != null ? String(tt.critical_high) : "-";

        rows.push([dateStr, weekday, patient.name || "-", patientCode, gender, age,
          performer, role, deviceId, notes,
          name, unit, cat, meth, val, status, bioRef, critLow, critHigh].map(q).join(","));
      }
    }
  }

  return Buffer.from(rows.join("\n"), "utf8").toString("base64");
}