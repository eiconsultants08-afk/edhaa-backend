import Users from "./users.js";
import Tokens from "./tokens.js";
import Devices from "./devices.js";

import { randomUUID } from "crypto";
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

import Plans from "./plans.js";
import PlanTestTypes from "./plan_test_types.js";

// Register all model associations
import "./associations.js";

export async function getUserByCondition(condition) {
  return Users.findOne({
    where: condition,
    raw: true,
  });
}

// Like getUserByCondition but also returns org_name + org_code nested under an `org` key.
// Used by the user profile endpoint so the app can display a clean org identifier.
// Uses two plain queries (no Sequelize include) to avoid association-ordering issues.
export async function getUserWithOrg(condition) {
  const user = await Users.findOne({ where: condition, raw: true });
  if (!user) return null;

  let org = null;
  if (user.org_id) {
    const rows = await sequelize.query(
      `SELECT org_name, org_code FROM organizations WHERE org_id = :oid LIMIT 1`,
      { replacements: { oid: user.org_id }, type: sequelize.QueryTypes.SELECT }
    );
    org = rows[0] || null;
  }

  return { ...user, org };
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
  return sequelize.transaction(async (t) => {
    await sequelize.query(`LOCK TABLE patients IN EXCLUSIVE MODE`, {
      transaction: t,
    });

    if (!data.patient_id) {
      const rows = await sequelize.query(
        `
        SELECT LPAD(
          (COALESCE(MAX(patient_id::int), 0) + 1)::text,
          5,
          '0'
        ) AS id
        FROM patients
        WHERE patient_id ~ '^[0-9]+$'
        `,
        {
          type: sequelize.QueryTypes.SELECT,
          transaction: t,
        },
      );

      data.patient_id = rows[0]?.id;
    }

    return Patients.create(data, { transaction: t });
  });
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
        model: Users,
        as: "enteredBy",
        attributes: ["user_id", "name", "username", "role"],
        required: false,
      },
      {
        model: PatientTestResults,
        as: "results",
        required: false,
        include: [
          {
            model: TestTypes,
            as: "testType",
            attributes: [
              "test_type_id", "name", "full_name", "unit","method",
              "normal_min", "normal_max",
              "male_min", "male_max",
              "female_min", "female_max",
              "category", "reference_text",
              "critical_low", "critical_high", "is_qualitative",
              "specimen_type",
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
  return sequelize.query(`
    SELECT tt.*
    FROM test_types tt
    JOIN plan_test_types ptt ON ptt.test_type_id = tt.test_type_id
    JOIN organizations o ON o.plan_id = ptt.plan_id
    WHERE o.org_id = :org_id
    ORDER BY tt.name ASC
  `, { replacements: { org_id }, type: sequelize.QueryTypes.SELECT });
}

/** Returns the set of test_type_ids from `ids` that are valid for the org's plan. */
export async function getOrgPlanTestTypeIds(ids, org_id) {
  if (!ids || ids.length === 0) return new Set();
  const rows = await sequelize.query(`
    SELECT tt.test_type_id
    FROM test_types tt
    JOIN plan_test_types ptt ON ptt.test_type_id = tt.test_type_id
    JOIN organizations o ON o.plan_id = ptt.plan_id
    WHERE o.org_id = :org_id AND tt.test_type_id IN (:ids)
  `, { replacements: { org_id, ids }, type: sequelize.QueryTypes.SELECT });
  return new Set(rows.map(r => r.test_type_id));
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
        [sequelize.col("testType.full_name"), "test_full_name"],
        [sequelize.col("testType.unit"), "test_type_unit"],
        [sequelize.col("testType.normal_min"), "normal_min"],
        [sequelize.col("testType.normal_max"), "normal_max"],
        [sequelize.col("testType.male_min"), "male_min"],
        [sequelize.col("testType.male_max"), "male_max"],
        [sequelize.col("testType.female_min"), "female_min"],
        [sequelize.col("testType.female_max"), "female_max"],
        [sequelize.col("testType.category"), "category"],
        // [sequelize.col("testType.method_options"), "method_options"],
        [sequelize.col("testType.method"), "method"],
        [sequelize.col("testType.reference_text"), "reference_text"],
        [sequelize.col("testType.critical_low"), "critical_low"],
        [sequelize.col("testType.critical_high"), "critical_high"],
        [sequelize.col("testType.is_qualitative"), "is_qualitative"],
        [sequelize.col("testType.specimen_type"), "specimen_type"],
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
        [sequelize.col("testType.full_name"), "test_full_name"],
        [sequelize.col("testType.unit"), "test_type_unit"],
        [sequelize.col("testType.normal_min"), "normal_min"],
        [sequelize.col("testType.normal_max"), "normal_max"],
        [sequelize.col("testType.male_min"), "male_min"],
        [sequelize.col("testType.male_max"), "male_max"],
        [sequelize.col("testType.female_min"), "female_min"],
        [sequelize.col("testType.female_max"), "female_max"],
        [sequelize.col("testType.category"), "category"],
        // [sequelize.col("testType.method_options"), "method_options"],
        [sequelize.col("testType.method"), "method"],
        [sequelize.col("testType.reference_text"), "reference_text"],
        [sequelize.col("testType.critical_low"), "critical_low"],
        [sequelize.col("testType.critical_high"), "critical_high"],
        [sequelize.col("testType.is_qualitative"), "is_qualitative"],
        [sequelize.col("testType.specimen_type"), "specimen_type"],
        [sequelize.col("patient.sample_id"), "sample_id"],
        [sequelize.col("patient.name"), "patient_name"],
        [sequelize.col("patient.gender"), "patient_gender"],
        [sequelize.col("patient.age"), "patient_age"],
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
        [sequelize.col("org.address"), "org_address"],
      ],
    },
  });
  if (!history) return null;

  const patient = await Patients.findOne({
    where: { patient_id: history.patient_id },
    raw: true,
    attributes: ["patient_id","sample_id", "name", "gender", "age", "phone", "email"],
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
        [sequelize.col("testType.full_name"), "test_full_name"],
        [sequelize.col("testType.unit"), "test_type_unit"],
        [sequelize.col("testType.normal_min"), "normal_min"],
        [sequelize.col("testType.normal_max"), "normal_max"],
        [sequelize.col("testType.male_min"), "male_min"],
        [sequelize.col("testType.male_max"), "male_max"],
        [sequelize.col("testType.female_min"), "female_min"],
        [sequelize.col("testType.female_max"), "female_max"],
        [sequelize.col("testType.category"), "category"],
        [sequelize.col("testType.method_options"), "method_options"],
        [sequelize.col("testType.reference_text"), "reference_text"],
        [sequelize.col("testType.critical_low"), "critical_low"],
        [sequelize.col("testType.critical_high"), "critical_high"],
        [sequelize.col("testType.is_qualitative"), "is_qualitative"],
        [sequelize.col("testType.specimen_type"), "specimen_type"],
        [sequelize.col("testType.method"), "method"],
      ],
    },
  });

  return {
    ...history,
    sample_id: patient?.sample_id || "",
    patient_name: patient?.name || "-",
    patient_gender: patient?.gender || "-",
    patient_age: patient?.age ?? "-",
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

export async function bulkUpdateTestResultsBySession(history_id, testsArray) {
  // testsArray: [{ test_type_id, value_num?, value_text?, method_used? }]
  const updates = testsArray.map(t =>
    PatientTestResults.update(
      {
        value_num: t.value_num ?? null,
        value_text: t.value_text ?? null,
        method_used: t.method_used ?? null,
      },
      { where: { history_id, test_type_id: t.test_type_id } }
    )
  );
  return Promise.all(updates);
}

/** Returns count of result rows for a session that still have no value recorded */
export async function countUnfilledResults(history_id) {
  return PatientTestResults.count({
    where: {
      history_id,
      value_num: null,
      value_text: null,
    },
  });
}

// ── Analytics ────────────────────────────────────────────────────────────────

/** KPI overview — patient/session/device totals for the org */
export async function getAnalyticsOverview(org_id) {
  const rows = await sequelize.query(`
    SELECT
      (SELECT COUNT(*)::int FROM patients       WHERE org_id = :org_id)                                                      AS total_patients,
      (SELECT COUNT(*)::int FROM test_histories WHERE org_id = :org_id)                                                      AS total_sessions,
      (SELECT COUNT(*)::int FROM test_histories WHERE org_id = :org_id AND status = 'COMPLETED')                             AS completed_sessions,
      (SELECT COUNT(*)::int FROM test_histories WHERE org_id = :org_id AND status = 'PENDING')                               AS pending_sessions,
      (SELECT COUNT(*)::int FROM devices        WHERE org_id = :org_id)                                                      AS total_devices,
      (SELECT COUNT(*)::int FROM devices        WHERE org_id = :org_id AND assigned_to_user_id IS NOT NULL)                  AS assigned_devices,
      (SELECT COUNT(*)::int FROM test_histories WHERE org_id = :org_id AND DATE(test_date AT TIME ZONE 'UTC') = CURRENT_DATE) AS sessions_today
  `, { replacements: { org_id }, type: sequelize.QueryTypes.SELECT });
  return rows[0] || {};
}

/** Session completed/pending counts within a date range */
export async function getAnalyticsSessionStatus(org_id, startDate, endDate) {
  const rows = await sequelize.query(`
    SELECT
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)::int AS completed,
      SUM(CASE WHEN status = 'PENDING'   THEN 1 ELSE 0 END)::int AS pending
    FROM test_histories
    WHERE org_id    = :org_id
      AND test_date >= :startDate::timestamptz
      AND test_date <= :endDate::timestamptz
  `, { replacements: { org_id, startDate, endDate }, type: sequelize.QueryTypes.SELECT });
  return rows[0] || { completed: 0, pending: 0 };
}

/** Daily completed test-sessions within a date range, ordered ASC */
export async function getAnalyticsDailyTests(org_id, startDate, endDate) {
  return sequelize.query(`
    SELECT
      TO_CHAR(DATE(th.test_date AT TIME ZONE 'UTC'), 'DD/MM') AS label,
      COUNT(*)::int AS count
    FROM test_histories th
    WHERE th.org_id    = :org_id
      AND th.status    = 'COMPLETED'
      AND th.test_date >= :startDate::timestamptz
      AND th.test_date <= :endDate::timestamptz
    GROUP BY DATE(th.test_date AT TIME ZONE 'UTC')
    ORDER BY DATE(th.test_date AT TIME ZONE 'UTC') ASC
  `, { replacements: { org_id, startDate, endDate }, type: sequelize.QueryTypes.SELECT });
}

/** Completed test count per device (top 8) within a date range */
export async function getAnalyticsTestsPerDevice(org_id, startDate, endDate) {
  return sequelize.query(`
    SELECT
      COALESCE(d.serial_no, th.device_id, 'Unknown') AS label,
      COUNT(*)::int AS count
    FROM test_histories th
    LEFT JOIN devices d ON th.device_id = d.device_id
    WHERE th.org_id    = :org_id
      AND th.device_id IS NOT NULL
      AND th.test_date >= :startDate::timestamptz
      AND th.test_date <= :endDate::timestamptz
    GROUP BY th.device_id, d.serial_no
    ORDER BY count DESC
    LIMIT 8
  `, { replacements: { org_id, startDate, endDate }, type: sequelize.QueryTypes.SELECT });
}

/** Result count grouped by test type (top 8) within a date range */
export async function getAnalyticsTestTypeDistribution(org_id, startDate, endDate) {
  return sequelize.query(`
    SELECT tt.name AS label, COUNT(*)::int AS count
    FROM patient_test_results ptr
    JOIN test_types    tt ON ptr.test_type_id  = tt.test_type_id
    JOIN test_histories th ON ptr.history_id   = th.history_id
    WHERE ptr.org_id    = :org_id
      AND th.test_date >= :startDate::timestamptz
      AND th.test_date <= :endDate::timestamptz
    GROUP BY tt.test_type_id, tt.name
    ORDER BY count DESC
    LIMIT 8
  `, { replacements: { org_id, startDate, endDate }, type: sequelize.QueryTypes.SELECT });
}

/** Abnormal result rate per test type (top 6) within a date range */
export async function getAnalyticsAbnormalRates(org_id, startDate, endDate) {
  return sequelize.query(`
    SELECT
      tt.name AS label,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE ptr.value_num < tt.normal_min OR ptr.value_num > tt.normal_max
      )::int AS abnormal
    FROM patient_test_results ptr
    JOIN test_types    tt ON ptr.test_type_id = tt.test_type_id
    JOIN test_histories th ON ptr.history_id  = th.history_id
    WHERE ptr.org_id      = :org_id
      AND ptr.value_num   IS NOT NULL
      AND tt.normal_min   IS NOT NULL
      AND tt.normal_max   IS NOT NULL
      AND th.test_date   >= :startDate::timestamptz
      AND th.test_date   <= :endDate::timestamptz
    GROUP BY tt.test_type_id, tt.name
    HAVING COUNT(*) > 0
    ORDER BY (COUNT(*) FILTER (WHERE ptr.value_num < tt.normal_min OR ptr.value_num > tt.normal_max)) DESC
    LIMIT 6
  `, { replacements: { org_id, startDate, endDate }, type: sequelize.QueryTypes.SELECT });
}

/** New patients registered within a date range, grouped by week */
export async function getAnalyticsWeeklyPatients(org_id, startDate, endDate) {
  return sequelize.query(`
    SELECT
      TO_CHAR(DATE_TRUNC('week', created_at AT TIME ZONE 'UTC'), 'DD/MM') AS label,
      COUNT(*)::int AS count
    FROM patients
    WHERE org_id      = :org_id
      AND created_at >= :startDate::timestamptz
      AND created_at <= :endDate::timestamptz
    GROUP BY DATE_TRUNC('week', created_at AT TIME ZONE 'UTC')
    ORDER BY DATE_TRUNC('week', created_at AT TIME ZONE 'UTC') ASC
  `, { replacements: { org_id, startDate, endDate }, type: sequelize.QueryTypes.SELECT });
}

/** Completed sessions per technician (top 6) within a date range */
export async function getAnalyticsTechnicianActivity(org_id, startDate, endDate) {
  return sequelize.query(`
    SELECT
      COALESCE(u.name, 'Unknown') AS label,
      COUNT(*)::int AS count
    FROM test_histories th
    LEFT JOIN users u ON th.entered_by_user_id = u.user_id
    WHERE th.org_id    = :org_id
      AND th.status    = 'COMPLETED'
      AND th.test_date >= :startDate::timestamptz
      AND th.test_date <= :endDate::timestamptz
    GROUP BY u.user_id, u.name
    ORDER BY count DESC
    LIMIT 6
  `, { replacements: { org_id, startDate, endDate }, type: sequelize.QueryTypes.SELECT });
}

/** Gender distribution of all patients in the org */
export async function getAnalyticsPatientGender(org_id) {
  return sequelize.query(`
    SELECT
      COALESCE(gender::text, 'Unknown') AS label,
      COUNT(*)::int AS count
    FROM patients
    WHERE org_id = :org_id
    GROUP BY gender
    ORDER BY count DESC
  `, { replacements: { org_id }, type: sequelize.QueryTypes.SELECT });
}

/** Sessions for a specific test type within a date range (drill-down) */
export async function getAnalyticsTestTypeSessions(org_id, testTypeName, startDate, endDate) {
  return sequelize.query(`
    SELECT
      th.history_id,
      p.name                        AS patient_name,
      COALESCE(u.name, 'Unknown')   AS technician_name,
      th.test_date,
      th.status
    FROM patient_test_results ptr
    JOIN test_types    tt ON ptr.test_type_id = tt.test_type_id
    JOIN test_histories th ON ptr.history_id  = th.history_id
    JOIN patients       p  ON th.patient_id   = p.patient_id
    LEFT JOIN users     u  ON th.entered_by_user_id = u.user_id
    WHERE ptr.org_id    = :org_id
      AND tt.name        = :testTypeName
      AND th.test_date  >= :startDate::timestamptz
      AND th.test_date  <= :endDate::timestamptz
    GROUP BY th.history_id, p.name, u.name, th.test_date, th.status
    ORDER BY th.test_date DESC
    LIMIT 50
  `, { replacements: { org_id, testTypeName, startDate, endDate }, type: sequelize.QueryTypes.SELECT });
}

/**
 * Returns all completed test sessions with full result context for CSV export.
 * @param {string} org_id
 * @param {string} startDate  — ISO string (start of day)
 * @param {string} endDate    — ISO string (end of day)
 * @param {string|null} entered_by_user_id — restrict to a single technician (optional)
 */
export async function getResultsForCsvExport(org_id, startDate, endDate, entered_by_user_id = null) {
  const where = {
    org_id,
    status: "COMPLETED",
    test_date: { [Op.between]: [startDate, endDate] },
  };
  if (entered_by_user_id) where.entered_by_user_id = entered_by_user_id;

  return TestHistory.findAll({
    where,
    order: [["test_date", "ASC"]],
    include: [
      {
        model: Users,
        as: "enteredBy",
        attributes: ["name", "username", "role"],
        required: false,
      },
      {
        model: Patients,
        as: "patient",
        attributes: ["patient_id", "name", "gender", "age"],
        required: false,
      },
      {
        model: PatientTestResults,
        as: "results",
        required: false,
        include: [
          {
            model: TestTypes,
            as: "testType",
            attributes: [
              "name", "full_name", "unit", "category",
              "reference_text", "critical_low", "critical_high",
              "normal_min", "normal_max",
              "male_min", "male_max",
              "female_min", "female_max",
              "is_qualitative", "specimen_type", "method",
            ],
            required: false,
          },
        ],
      },
    ],
  });
}

export async function getOrgById(org_id) {
  return Organization.findOne({
    where: { org_id },
    raw: true,
    attributes: ["org_id", "org_name", "address"],
  });
}

export async function createOrganization(data) {
  return Organization.create(data);
}

export async function updateOrganization(org_id, data) {
  const [updated] = await Organization.update(data, {
    where: { org_id },
  });

  if (!updated) return null;

  return Organization.findOne({
    where: { org_id },
    raw: true,
  });
}

export async function getOrganizations(limit, offset) {
  const options = {
    limit,
    offset,
    order: [["created_at", "DESC"]],
    raw: true,
  };

  if (offset > 0) options.offset = offset;

  return Organization.findAndCountAll(options);
}

export async function getSuperAdminCounts() {
  const rows = await sequelize.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM organizations) AS total_organizations,
      (SELECT COUNT(*)::int FROM users WHERE role = 'ADMIN') AS total_admins,
      (SELECT COUNT(*)::int FROM users WHERE role = 'TECHNICIAN') AS total_technicians,
      (SELECT COUNT(*)::int FROM test_types) AS total_tests,
      (SELECT COUNT(*)::int FROM devices) AS total_devices,
      (SELECT COUNT(*)::int FROM patients) AS total_patients
    `,
    { type: sequelize.QueryTypes.SELECT }
  );

  return rows[0];
}

export async function getAllTestTypes(limit, offset) {
  const options = {
    limit,
    order: [["created_at", "DESC"]],
    raw: true,
  };

  if (offset > 0) options.offset = offset;

  return TestTypes.findAndCountAll(options);
}

export async function getTestTypeById(test_type_id) {
  return TestTypes.findOne({
    where: { test_type_id },
    raw: true,
  });
}

export async function updateTestType(test_type_id, data) {
  const [updated] = await TestTypes.update(data, {
    where: { test_type_id },
  });

  if (!updated) return null;

  return TestTypes.findOne({
    where: { test_type_id },
    raw: true,
  });
}

export async function updateUser(user_id, data) {
  const [updated] = await Users.update(data, {
    where: { user_id },
  });

  if (!updated) return null;

  return Users.findOne({
    where: { user_id },
    raw: true,
  });
}

export async function getSuperAdminAnalytics() {
  const [
    mostUsedDevices,
    mostPerformedTests,
    monthlyTestTrend,
    organizationActivity,
    organizationPatients,
    testCategoryBreakdown,
    topTechnicians,
    testCompletionRate,
    genderAnalysis,
    avgTurnaroundByOrg,
    patientTurnaround,
  ] = await Promise.all([

    sequelize.query(
      `
  WITH device_test_counts AS (
    SELECT
      TRIM(th.device_id) AS device_id,
      COALESCE(tt.full_name, tt.name) AS test_name,
      COUNT(ptr.result_id)::int AS test_count
    FROM patient_test_results ptr
    JOIN test_histories th
      ON th.history_id = ptr.history_id
    JOIN test_types tt
      ON tt.test_type_id = ptr.test_type_id
    WHERE th.device_id IS NOT NULL
    GROUP BY TRIM(th.device_id), tt.full_name, tt.name
  ),
  device_counts AS (
    SELECT
      device_id,
      SUM(test_count)::int AS count
    FROM device_test_counts
    GROUP BY device_id
  )
  SELECT
    dc.device_id AS name,
    dc.count,
    COALESCE(
      json_agg(
        json_build_object(
          'test_name', dtc.test_name,
          'test_count', dtc.test_count
        )
        ORDER BY dtc.test_count DESC
      ) FILTER (WHERE dtc.test_name IS NOT NULL),
      '[]'
    ) AS tests
  FROM device_counts dc
  LEFT JOIN device_test_counts dtc
    ON dtc.device_id = dc.device_id
  GROUP BY dc.device_id, dc.count
  ORDER BY dc.count DESC
  LIMIT 10
  `,
      { type: sequelize.QueryTypes.SELECT }
    ),

    sequelize.query(
      `
      SELECT 
        COALESCE(tt.name, 'Unknown') AS name,
        COUNT(ptr.result_id)::int AS count
      FROM patient_test_results ptr
      LEFT JOIN test_types tt ON tt.test_type_id = ptr.test_type_id
      GROUP BY tt.test_type_id, tt.name
      ORDER BY count DESC
      LIMIT 10
      `,
      { type: sequelize.QueryTypes.SELECT }
    ),

    sequelize.query(
      `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', test_date), 'Mon YYYY') AS name,
        COUNT(history_id)::int AS count
      FROM test_histories
      GROUP BY DATE_TRUNC('month', test_date)
      ORDER BY DATE_TRUNC('month', test_date) ASC
      LIMIT 12
      `,
      { type: sequelize.QueryTypes.SELECT }
    ),

    sequelize.query(
      `
  WITH test_counts AS (
    SELECT
      th.org_id,
      COALESCE(tt.full_name, tt.name) AS test_name,
      COUNT(ptr.result_id)::int AS test_count
    FROM patient_test_results ptr
    JOIN test_histories th ON th.history_id = ptr.history_id
    JOIN test_types tt ON tt.test_type_id = ptr.test_type_id
    GROUP BY th.org_id, tt.full_name, tt.name
  ),
  org_counts AS (
    SELECT
      org_id,
      SUM(test_count)::int AS count
    FROM test_counts
    GROUP BY org_id
  )
  SELECT
    COALESCE(o.org_name, 'Unknown') AS name,
    COALESCE(oc.count, 0)::int AS count,
    COALESCE(
      json_agg(
        json_build_object(
          'test_name', tc.test_name,
          'test_count', tc.test_count
        )
        ORDER BY tc.test_count DESC
      ) FILTER (WHERE tc.test_name IS NOT NULL),
      '[]'
    ) AS tests
  FROM org_counts oc
  LEFT JOIN organizations o ON o.org_id = oc.org_id
  LEFT JOIN test_counts tc ON tc.org_id = oc.org_id
  GROUP BY o.org_id, o.org_name, oc.count
  ORDER BY oc.count DESC
  LIMIT 10
  `,
      { type: sequelize.QueryTypes.SELECT }
    ),

    sequelize.query(
      `
      SELECT
        COALESCE(o.org_name, 'Unknown') AS name,
        COUNT(p.patient_id)::int AS count
      FROM patients p
      LEFT JOIN organizations o ON o.org_id = p.org_id
      GROUP BY o.org_id, o.org_name
      ORDER BY count DESC
      LIMIT 10
      `,
      { type: sequelize.QueryTypes.SELECT }
    ),

    sequelize.query(
      `
      SELECT
        COALESCE(tt.category, 'Uncategorized') AS name,
        COUNT(ptr.result_id)::int AS count
      FROM patient_test_results ptr
      LEFT JOIN test_types tt ON tt.test_type_id = ptr.test_type_id
      GROUP BY tt.category
      ORDER BY count DESC
      LIMIT 10
      `,
      { type: sequelize.QueryTypes.SELECT }
    ),

    sequelize.query(
      `
      SELECT 
        COALESCE(u.name, 'Unknown') AS name,
        COUNT(th.history_id)::int AS count
      FROM test_histories th
      LEFT JOIN users u ON u.user_id = th.entered_by_user_id
      GROUP BY u.user_id, u.name
      ORDER BY count DESC
      LIMIT 10
      `,
      { type: sequelize.QueryTypes.SELECT }
    ),

    sequelize.query(
      `
      SELECT
        COALESCE(status::text, 'UNKNOWN') AS name,
        COUNT(history_id)::int AS count
      FROM test_histories
      GROUP BY status::text
      ORDER BY count DESC
      `,
      { type: sequelize.QueryTypes.SELECT }
    ),

    sequelize.query(
      `
      SELECT
        COALESCE(gender::text, 'Unknown') AS name,
        COUNT(patient_id)::int AS count
      FROM patients
      GROUP BY gender::text
      ORDER BY count DESC
      `,
      { type: sequelize.QueryTypes.SELECT }
    ),

    sequelize.query(
      `
      SELECT
        COALESCE(o.org_name, 'Unknown') AS name,
        ROUND(
          AVG(EXTRACT(EPOCH FROM (th.completed_at - th.created_at)) / 60)
        )::int AS avg_minutes
      FROM test_histories th
      LEFT JOIN organizations o ON o.org_id = th.org_id
      WHERE th.status = 'COMPLETED'
        AND th.completed_at IS NOT NULL
      GROUP BY o.org_id, o.org_name
      ORDER BY avg_minutes DESC
      LIMIT 10
      `,
          { type: sequelize.QueryTypes.SELECT }
        ),

        sequelize.query(
          `
      SELECT
        p.patient_id,
        p.name AS patient_name,
        COALESCE(o.org_name, 'Unknown') AS org_name,
        TO_CHAR(th.created_at, 'DD Mon YYYY, HH24:MI') AS registered_at,
        TO_CHAR(th.completed_at, 'DD Mon YYYY, HH24:MI') AS completed_at,
        ROUND(
          EXTRACT(EPOCH FROM (th.completed_at - th.created_at)) / 60
        )::int AS turnaround_minutes
      FROM test_histories th
      JOIN patients p ON p.patient_id = th.patient_id
      LEFT JOIN organizations o ON o.org_id = th.org_id
      WHERE th.status = 'COMPLETED'
        AND th.completed_at IS NOT NULL
      ORDER BY th.completed_at DESC
      LIMIT 20
  `,
      { type: sequelize.QueryTypes.SELECT }
    ),

  ]);

  return {
    mostUsedDevices,
    mostPerformedTests,
    monthlyTestTrend,
    organizationActivity,
    organizationPatients,
    testCategoryBreakdown,
    topTechnicians,
    testCompletionRate,
    genderAnalysis,
    avgTurnaroundByOrg,
    patientTurnaround,
  };
}

export async function getPlans(limit, offset) {
  const options = {
    limit,
    order: [["created_at", "DESC"]],
    raw: true,
  };

  if (offset > 0) options.offset = offset;

  return Plans.findAndCountAll(options);
}

export async function getPlanById(plan_id) {
  return Plans.findOne({
    where: { plan_id },
    raw: true,
  });
}

export async function createPlan(data) {
  return Plans.create(data);
}

export async function updatePlan(plan_id, data) {
  const [updated] = await Plans.update(data, {
    where: { plan_id },
  });

  if (!updated) return null;

  return Plans.findOne({
    where: { plan_id },
    raw: true,
  });
}

export async function replacePlanTestTypes(plan_id, test_type_ids = []) {
  await PlanTestTypes.destroy({
    where: { plan_id },
  });

  if (!Array.isArray(test_type_ids) || test_type_ids.length === 0) {
    return [];
  }

  const rows = test_type_ids.map((test_type_id) => ({
    plan_id,
    test_type_id,
  }));

  return PlanTestTypes.bulkCreate(rows);
}

export async function createTestType(data) {
  return await TestTypes.create(data);
}

export async function getSuperAdminDevices(limit, offset) {
  return Devices.findAndCountAll({
    limit,
    offset,
    order: [["created_at", "DESC"]],
    raw: true,
  });
}

export async function getSuperAdminDeviceById(device_id) {
  return Devices.findOne({
    where: { device_id },
    raw: true,
  });
}

export async function createSuperAdminDevice(data) {
  return Devices.create(data);
}

export async function updateSuperAdminDevice(device_id, data) {
  const [updated] = await Devices.update(data, {
    where: { device_id },
  });

  if (!updated) return null;

  return Devices.findOne({
    where: { device_id },
    raw: true,
  });
}

export async function createUartTestResults({ patient_id, test_name, value_num, method_used, entered_by_user_id, department_id, org_id }) {
  return sequelize.transaction(async (t) => {
    const created = [];

    for (const entry of entries) {
      const { patient_id, test_name, value_num, method_used } = entry;

      const [testType] = await sequelize.query(`
        SELECT tt.*
        FROM test_types tt
        JOIN plan_test_types ptt ON ptt.test_type_id = tt.test_type_id
        JOIN organizations o ON o.plan_id = ptt.plan_id
        WHERE o.org_id = :org_id AND tt.name = :name
        LIMIT 1
      `, { replacements: { org_id, name: test_name }, type: sequelize.QueryTypes.SELECT, transaction: t });
      if (!testType) throw new Error(`Test type "${test_name}" not found in org plan`);

    const history = await TestHistory.create({
      history_id: randomUUID(),
      patient_id,
      org_id,
      department_id: department_id || null,
      entered_by_user_id,
      test_date: new Date(),
      status: "COMPLETED",
    }, { transaction: t });

    await PatientTestResults.create({
      result_id: randomUUID(),
      history_id: history.history_id,
      patient_id,
      org_id,
      test_type_id: testType.test_type_id,
      value_num,
      method_used: method_used || null,
    }, { transaction: t });

      created.push({ patient_id, history_id: history.history_id });
    }

    return created;
  });
}

// Finds the single PENDING session for a patient, fills in result values from UART,
// and marks the session COMPLETED — all in one transaction.
export async function updateUartSession({ patient_id, org_id, results }) {
  return sequelize.transaction(async (t) => {
    const pending = await TestHistory.findAll({
      where: { patient_id, org_id, status: "PENDING" },
      order: [["test_date", "DESC"]],
      limit: 2,
      transaction: t,
    });

    if (pending.length === 0) throw new Error("No pending session found for this patient");
    if (pending.length > 1)  throw new Error("Multiple pending sessions found — specify history_id");

    const history_id = pending[0].history_id;

    for (const { test_name, value_num, value_text, method_used } of results) {
      const [testType] = await sequelize.query(`
        SELECT tt.test_type_id
        FROM test_types tt
        JOIN plan_test_types ptt ON ptt.test_type_id = tt.test_type_id
        JOIN organizations o ON o.plan_id = ptt.plan_id
        WHERE o.org_id = :org_id AND tt.name = :name
        LIMIT 1
      `, { replacements: { org_id, name: test_name }, type: sequelize.QueryTypes.SELECT, transaction: t });

      if (!testType) throw new Error(`Test type "${test_name}" not found in org plan`);

      await PatientTestResults.update(
        {
          value_num:   value_num  ?? null,
          value_text:  value_text ?? null,
          method_used: method_used || null,
        },
        { where: { history_id, test_type_id: testType.test_type_id }, transaction: t }
      );
    }

    await TestHistory.update(
      { status: "COMPLETED" },
      { where: { history_id }, transaction: t }
    );

    return { history_id };
  });
}