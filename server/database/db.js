import Users from "./users.js";
import Tokens from "./tokens.js";
import Devices from "./devices.js";

import { Op, fn, col } from "sequelize";
import sequelize from "./connectdb.js";
import { constants } from "../constants.js";
import { checkToken } from "../utils.js";
import Organization from "./organization.js";
import Department from "./department.js";
import Patients from "./patients.js";
import PatientTestResults from "./patient_test_results.js";
import TestTypes from "./test_types.js";
import TestHistory from "./test_history.js";

// Register all model associations
import "./associations.js";

export async function getUserByCondition(condition) {
  return Users.findOne({
    where: condition,
    raw: true,
  });
}

export async function createTechnician(data) {
  return Users.create(data);
}

export async function updateToken(user_id, org_id, refreshToken) {

  // Verify + decode refresh token
  const decoded = checkToken(refreshToken, constants.REFRESH_TOKEN_SECRET);

  // exp is in seconds → convert to milliseconds
  const expiresAt = new Date(decoded.exp * 1000);

  let cToken = await Tokens.findOne({ where: { user_id, org_id } });

  if (cToken === null) {
    await Tokens.create({
      token: refreshToken,
      user_id,
      org_id,
      expires_at: expiresAt,
    });
  } else {
    cToken.set({
      token: refreshToken,
      expires_at: expiresAt,
    });
    await cToken.save();
  }
}
export async function verifyToken(user_id, org_id, token) {
  let cToken = await Tokens.findOne({ where: { user_id: user_id, org_id: org_id } });
  if (cToken === null) {
    return false;
  }
  if (cToken.token !== token) {
    await cToken.destroy();
    return false;
  }
  return true;
}

export async function removeToken(user_id, org_id) {
  let cToken = await Tokens.findOne({ where: { user_id: user_id, org_id: org_id } });
  if (cToken !== null) {
    await cToken.destroy();
  }
}



// ADMIN APIS 

//get all devices
export async function getDevices(limit, offset, conditions) {
  const options = {
    where: conditions,
    limit,
    order: [["created_at", "DESC"]],
    raw: true,          // ✅ flat output
    subQuery: false,    // ✅ helps with limit + include
    distinct: true,     // ✅ correct count
    include: [
      { model: Organization, as: "org", attributes: [], required: false },
      { model: Department, as: "department", attributes: [], required: false },
      { model: Users, as: "assignedTo", attributes: [], required: false },
      { model: Users, as: "assignedBy", attributes: [], required: false },
    ],
    attributes: {
      include: [
        // Org
        [sequelize.col("org.org_id"), "org_id"],
        [sequelize.col("org.org_name"), "org_name"],
        [sequelize.col("org.code"), "org_code"],
        [sequelize.col("org.status"), "org_status"],

        // Department
        [sequelize.col("department.department_id"), "department_id"],
        [sequelize.col("department.department_name"), "department_name"],

        // Assigned To (Technician)
        [sequelize.col("assignedTo.user_id"), "assigned_to_user_id"],
        [sequelize.col("assignedTo.name"), "assigned_to_name"],
        [sequelize.col("assignedTo.email"), "assigned_to_email"],
        [sequelize.col("assignedTo.username"), "assigned_to_username"],
        [sequelize.col("assignedTo.role"), "assigned_to_role"],

        // Assigned By (Admin)
        [sequelize.col("assignedBy.user_id"), "assigned_by_user_id"],
        [sequelize.col("assignedBy.name"), "assigned_by_name"],
        [sequelize.col("assignedBy.email"), "assigned_by_email"],
        [sequelize.col("assignedBy.username"), "assigned_by_username"],
        [sequelize.col("assignedBy.role"), "assigned_by_role"],
      ],
    },
  };

  if (offset > 0) options.offset = offset;

  return Devices.findAndCountAll(options);
}


//get device by id 
export async function getDeviceByIdFlat(device_id) {
  return Devices.findOne({
    where: { device_id },
    raw: true,
    subQuery: false,

    include: [
      { model: Organization, as: "org", attributes: [], required: false },
      { model: Department, as: "department", attributes: [], required: false },
      { model: Users, as: "assignedTo", attributes: [], required: false },
      { model: Users, as: "assignedBy", attributes: [], required: false },
    ],

    attributes: {
      include: [
        // ✅ Organization (flat)
        [sequelize.col("org.org_name"), "org_name"],
        [sequelize.col("org.code"), "org_code"],
        [sequelize.col("org.status"), "org_status"],

        // ✅ Department (flat)
        [sequelize.col("department.department_name"), "department_name"],

        // ✅ Assigned To (flat)
        [sequelize.col("assignedTo.name"), "assigned_to_name"],
        [sequelize.col("assignedTo.email"), "assigned_to_email"],
        [sequelize.col("assignedTo.username"), "assigned_to_username"],
        [sequelize.col("assignedTo.role"), "assigned_to_role"],
        [sequelize.col("assignedTo.status"), "assigned_to_status"],

        // ✅ Assigned By (flat)
        [sequelize.col("assignedBy.name"), "assigned_by_name"],
        [sequelize.col("assignedBy.email"), "assigned_by_email"],
        [sequelize.col("assignedBy.username"), "assigned_by_username"],
        [sequelize.col("assignedBy.role"), "assigned_by_role"],
        [sequelize.col("assignedBy.status"), "assigned_by_status"],
      ],
    },
  });
}

export async function getUsers(limit, offset, conditions) {
  let options = {
    where: conditions,
    limit,
    order: [["created_at", "DESC"]],
    raw: true,
    subQuery: false,
    distinct: true,

    attributes: {
      include: [
        ...constants.USER_ATTRIBUTES.map(attr => attr),

        // ✅ Organization (alias: org)
        [sequelize.col("org.org_name"), "org_name"],
        [sequelize.col("org.code"), "org_code"],
        [sequelize.col("org.status"), "org_status"],

        // ✅ Department
        [sequelize.col("department.department_name"), "department_name"],
      ],
    },

    include: [
      {
        model: Organization,
        as: "org",
        attributes: [],
        required: false,
      },
      {
        model: Department,
        as: "department",
        attributes: [],
        required: false,
      },
    ],
  };

  if (offset > 0) {
    options.offset = offset;
  }

  return Users.findAndCountAll(options);
}


// TECHNICIAN 
// db.js


export async function getPatients(limit, offset, conditions) {
  const options = {
    where: conditions,
    limit,
    order: [["created_at", "DESC"]],
    raw: true,
    subQuery: false,
    distinct: true,

    include: [
      { model: Organization, as: "org", attributes: [], required: false },
      { model: Users, as: "creator", attributes: [], required: false },
    ],

    attributes: {
      include: [
        [sequelize.col("org.org_name"), "org_name"],

        [sequelize.col("creator.name"), "created_by_name"],
        [sequelize.col("creator.username"), "created_by_username"],
        [sequelize.col("creator.email"), "created_by_email"],
        [sequelize.col("creator.role"), "created_by_role"],
      ],
    },
  };

  if (offset > 0) options.offset = offset;

  return Patients.findAndCountAll(options);
}

export async function getPatientByIdFlat(conditions) {
  return Patients.findOne({
    where: conditions,
    raw: true,
    subQuery: false,

    include: [
      { model: Organization, as: "org", attributes: [], required: false },
      { model: Users, as: "creator", attributes: [], required: false },
    ],

    attributes: {
      include: [
        [sequelize.col("org.org_name"), "org_name"],

        [sequelize.col("creator.name"), "created_by_name"],
        [sequelize.col("creator.username"), "created_by_username"],
        [sequelize.col("creator.email"), "created_by_email"],
        [sequelize.col("creator.role"), "created_by_role"],
      ],
    },
  });
}

export async function createPatient(data) {
  return Patients.create(data);
}

// ── TestHistory ────────────────────────────────────────────────────────────────

export async function createTestHistory(data) {
  return TestHistory.create(data);
}

/**
 * Returns TestHistory entries for a patient, each with nested PatientTestResults
 * and the test type embedded on each result.
 * Response shape: { count, rows: [ { history_id, test_date, device_id, notes, results: [...] } ] }
 */
export async function getPatientTestHistory(limit, offset, conditions) {
  const options = {
    where: conditions,
    limit,
    order: [["test_date", "DESC"]],
    subQuery: false,
    distinct: true,
    include: [
      {
        model: PatientTestResults,
        as: "results",
        required: false,
        include: [
          {
            model: TestTypes,
            as: "testType",
            attributes: [
              "test_type_id", "name", "unit",
              "normal_min", "normal_max",
              "male_min", "male_max",
              "female_min", "female_max",
              "threshold_operator", "threshold_value",
            ],
            required: false,
          },
        ],
      },
    ],
  };
  if (offset > 0) options.offset = offset;
  return TestHistory.findAndCountAll(options);
}

export async function getTestTypesByIds(ids) {
  return TestTypes.findAll({
    where: { test_type_id: ids },
    raw: true
  });
}

export async function bulkCreatePatientTestResults(dataArray) {
  return PatientTestResults.bulkCreate(dataArray);
}

export async function getTestTypesByOrg(org_id) {
  return TestTypes.findAll({
    where: { org_id, is_active: true },
    raw: true,
    order: [["name", "ASC"]],
  });
}

export async function getPatientTestResults(limit, offset, conditions) {
  const options = {
    where: conditions,
    limit,
    order: [["test_date", "DESC"]],
    raw: true,
    subQuery: false,
    distinct: true,

    include: [
      { model: TestTypes, as: "testType", attributes: [], required: false },
    ],

    attributes: {
      include: [
        [sequelize.col("testType.name"), "test_type_name"],
        [sequelize.col("testType.unit"), "test_type_unit"],
        [sequelize.col("testType.normal_min"), "normal_min"],
        [sequelize.col("testType.normal_max"), "normal_max"],
        [sequelize.col("testType.male_min"), "male_min"],
        [sequelize.col("testType.male_max"), "male_max"],
        [sequelize.col("testType.female_min"), "female_min"],
        [sequelize.col("testType.female_max"), "female_max"],
        [sequelize.col("testType.threshold_operator"), "threshold_operator"],
        [sequelize.col("testType.threshold_value"), "threshold_value"],
      ],
    },
  };

  if (offset > 0) options.offset = offset;

  return PatientTestResults.findAndCountAll(options);
}

export async function getTestResultByIdFlat(result_id) {
  // Step 1 — flat result with test type, patient, org
  const result = await PatientTestResults.findOne({
    where: { result_id },
    raw: true,
    subQuery: false,
    include: [
      { model: TestTypes, as: "testType", attributes: [], required: false },
      { model: Patients, as: "patient", attributes: [], required: false },
      { model: Organization, as: "org", attributes: [], required: false },
    ],
    attributes: {
      include: [
        [sequelize.col("testType.name"), "test_type_name"],
        [sequelize.col("testType.unit"), "test_type_unit"],
        [sequelize.col("testType.normal_min"), "normal_min"],
        [sequelize.col("testType.normal_max"), "normal_max"],
        [sequelize.col("testType.male_min"), "male_min"],
        [sequelize.col("testType.male_max"), "male_max"],
        [sequelize.col("testType.female_min"), "female_min"],
        [sequelize.col("testType.female_max"), "female_max"],
        [sequelize.col("testType.threshold_operator"), "threshold_operator"],
        [sequelize.col("testType.threshold_value"), "threshold_value"],
        [sequelize.col("patient.name"), "patient_name"],
        [sequelize.col("patient.gender"), "patient_gender"],
        [sequelize.col("patient.dob"), "patient_dob"],
        [sequelize.col("patient.phone"), "patient_phone"],
        [sequelize.col("patient.email"), "patient_email"],
        [sequelize.col("org.org_name"), "org_name"],
      ],
    },
  });

  if (!result || !result.history_id) return result;

  // Step 2 — session data from TestHistory (date, device, technician, notes, dept)
  const history = await TestHistory.findOne({
    where: { history_id: result.history_id },
    raw: true,
    subQuery: false,
    include: [
      { model: Users, as: "enteredBy", attributes: [], required: false },
      { model: Department, as: "department", attributes: [], required: false },
    ],
    attributes: {
      include: [
        [sequelize.col("enteredBy.name"), "entered_by_name"],
        [sequelize.col("enteredBy.username"), "entered_by_username"],
        [sequelize.col("department.department_name"), "department_name"],
      ],
    },
  });

  if (!history) return result;

  return {
    ...result,
    test_date: history.test_date,
    notes: history.notes,
    device_id: history.device_id,
    department_id: history.department_id,
    entered_by_name: history.entered_by_name,
    entered_by_username: history.entered_by_username,
    department_name: history.department_name,
  };
}

export async function getTestSessionFlat(history_id) {
  const history = await TestHistory.findOne({
    where: { history_id },
    raw: true,
    subQuery: false,
    include: [
      { model: Users, as: "enteredBy", attributes: [], required: false },
      { model: Department, as: "department", attributes: [], required: false },
      { model: Organization, as: "org", attributes: [], required: false },
    ],
    attributes: {
      include: [
        [sequelize.col("enteredBy.name"), "entered_by_name"],
        [sequelize.col("enteredBy.username"), "entered_by_username"],
        [sequelize.col("department.department_name"), "department_name"],
        [sequelize.col("org.org_name"), "org_name"],
      ],
    },
  });
  if (!history) return null;

  const patient = await Patients.findOne({
    where: { patient_id: history.patient_id },
    raw: true,
    attributes: ["patient_id", "name", "gender", "dob", "phone", "email"],
  });

  const results = await PatientTestResults.findAll({
    where: { history_id },
    raw: true,
    subQuery: false,
    include: [
      { model: TestTypes, as: "testType", attributes: [], required: false },
    ],
    attributes: {
      include: [
        [sequelize.col("testType.name"), "test_type_name"],
        [sequelize.col("testType.unit"), "test_type_unit"],
        [sequelize.col("testType.normal_min"), "normal_min"],
        [sequelize.col("testType.normal_max"), "normal_max"],
        [sequelize.col("testType.male_min"), "male_min"],
        [sequelize.col("testType.male_max"), "male_max"],
        [sequelize.col("testType.female_min"), "female_min"],
        [sequelize.col("testType.female_max"), "female_max"],
      ],
    },
  });

  return {
    ...history,
    patient_name: patient?.name || "-",
    patient_gender: patient?.gender || "-",
    patient_dob: patient?.dob || "-",
    patient_phone: patient?.phone || "-",
    patient_email: patient?.email || "-",
    results: results || [],
  };
}

export async function updateTestHistory(history_id, data) {
  const [rowsUpdated] = await TestHistory.update(data, { where: { history_id } });
  if (rowsUpdated === 0) return null;
  return TestHistory.findOne({ where: { history_id }, raw: true });
}

export async function updatePatient(patient_id, data) {
  const [rowsUpdated] = await Patients.update(data, { where: { patient_id } });
  if (rowsUpdated === 0) return null;
  return Patients.findOne({ where: { patient_id }, raw: true });
}

export async function updateTestResult(result_id, data) {
  const [rowsUpdated] = await PatientTestResults.update(data, { where: { result_id } });
  if (rowsUpdated === 0) return null;
  return PatientTestResults.findOne({ where: { result_id }, raw: true });
}

export async function assignDeviceToTechnician(device_id, data) {
  await Devices.update(data, { where: { device_id } });
  return getDeviceByIdFlat(device_id);
}

export async function getDevicesByTechnician(user_id) {
  return Devices.findAll({
    where: { assigned_to_user_id: user_id, status: "ACTIVE" },
    raw: true,
    order: [["assigned_at", "DESC"]],
    attributes: ["device_id", "serial_no", "model", "status", "firmware_version", "department_id", "org_id"],
  });
}

export async function createDevice(data) {
  return Devices.create(data);
}

export async function deactivateTechnician(user_id) {
  await Users.update({ status: "REMOVED" }, { where: { user_id } });
}

export async function activateTechnician(user_id) {
  await Users.update({ status: "ACTIVE" }, { where: { user_id } });
}

export async function inactivateTechnician(user_id) {
  await Users.update({ status: "INACTIVE" }, { where: { user_id } });
}

export async function setTechnicianWorking(user_id) {
  await Users.update({ status: "WORKING" }, { where: { user_id } });
}

export async function hasActiveToken(user_id) {
  const token = await Tokens.findOne({ where: { user_id, expires_at: { [Op.gt]: new Date() } } });
  return !!token;
}

export async function setTechnicianStatusOnLogout(user_id) {
  await Users.update({ status: "INACTIVE" }, { where: { user_id, role: "TECHNICIAN" } });
}

export async function unassignDevicesByTechnician(user_id) {
  await Devices.update(
    { assigned_to_user_id: null, assigned_by_user_id: null, assigned_at: null },
    { where: { assigned_to_user_id: user_id } }
  );
}

export async function getSessionCountByTechnician(user_id) {
  return TestHistory.count({ where: { entered_by_user_id: user_id } });
}