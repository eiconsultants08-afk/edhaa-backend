// controller.js
import { addData, failureResponse, getPaginationInfo, hashPassword } from "../../utils.js";
import { buildTestResultsXlsx } from "../../pdf/excelReportGenerator.js";
import { activateTechnician, inactivateTechnician, setTechnicianWorking, hasActiveToken, assignDeviceToTechnician, createDevice, createTechnician, deactivateTechnician, getDeviceByIdFlat, getDevices, getDevicesByTechnician, getSessionCountByTechnician, getUsers, getUserByCondition, unassignDevicesByTechnician, getPatients, getPatientByIdFlat, createPatient, updatePatient, getPatientTestHistory, getTestSessionFlat, getAnalyticsOverview, getAnalyticsDailyTests, getAnalyticsTestsPerDevice, getAnalyticsTestTypeDistribution, getAnalyticsAbnormalRates, getAnalyticsWeeklyPatients, getAnalyticsTechnicianActivity, getAnalyticsPatientGender, getAnalyticsSessionStatus, getAnalyticsTestTypeSessions, bulkCreatePatientTestResults, bulkUpdateTestResultsBySession, createTestHistory, getTestTypesByOrg, getOrgPlanTestTypeIds, updateTestHistory as updateTestHistoryDb, getResultsForCsvExport, getOrgById } from "../../database/db.js";
import moment from 'moment-timezone';
import { constants } from "../../constants.js";
import { emitToUser } from "../../socket.js";
import { generateSessionReportPdf, generateBulkReportPdf } from "../../pdf/reportGenerator.js";



export async function getAllDevices(req, res) {
    try {
        // 1) Auth check (use whatever your middleware sets)
        const { user_id } = req; // support both styles

        // 2) Validate params
        const { rows, page } = req.params;

        if (!rows || isNaN(Number(rows)) || Number(rows) <= 0) {
            return failureResponse(res, 400, "Invalid rows");
        }
        if (!page || isNaN(Number(page)) || Number(page) <= 0) {
            return failureResponse(res, 400, "Invalid page");
        }

        // 3) Load admin context
        const admin = await getUserByCondition({user_id});
        if (!admin) return failureResponse(res, 404, "User not found");

        if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
        if (admin.role !== "ADMIN") return failureResponse(res, 403, "Forbidden");

        // 4) Org/Dept must exist
        if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");
        if (!admin.department_id) return failureResponse(res, 403, "Admin department not assigned");

        // 5) Pagination
        const { limit, offset } = getPaginationInfo(rows, page);

        // 6) Conditions object (like your getAllUsers pattern)
        const conditions = {
            org_id: admin.org_id,
            department_id: admin.department_id,
        };

        if (req.query.unassigned === "true") {
            conditions.assigned_to_user_id = null;
        }

        if (req.query.status) {
            conditions.status = req.query.status;
        }
        const result = await getDevices(limit, offset, conditions); // returns { count, rows }

        return res.status(200).send({
            status: 200,
            data: result, // ✅ same structure you showed
            message: `Devices of ${admin.name}`
        });
    } catch (err) {
        console.error("getAllDevices error:", err);
        return res.status(500).send({ status: 500, message: "Internal server error" });
    }
}

export async function getDeviceByDeviceId(req, res) {
    try {
        const {user_id} = req;

        const { device_id } = req.params;
        if (!device_id) return failureResponse(res, 400, "device_id is required");

        const admin = await getUserByCondition({user_id});
        if (!admin) return failureResponse(res, 404, "User not found");

        if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
        if (admin.role !== "ADMIN") return failureResponse(res, 403, "Forbidden");

        if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");
        if (!admin.department_id) return failureResponse(res, 403, "unknown department");

        // ✅ Single query by device_id (with joins + flat)
        const device = await getDeviceByIdFlat(device_id);
        if (!device) return failureResponse(res, 404, "Device not found");

        // ✅ Scope check (authorization)
        if (device.org_id !== admin.org_id)
            return failureResponse(res, 403, "Device not in your organization");

        if (device.department_id !== admin.department_id)
            return failureResponse(res, 403, "Device not in your department");

        return res.status(200).send({
            status: 200,
            data: device, // ✅ flat
        });
    } catch (err) {
        console.error("getDeviceByDeviceId error:", err);
        return res.status(500).send({ status: 500, message: "Internal server error" });
    }
}


// device not assigned to technicians
export async function getDevicesNotAssignToTechnician(req, res) {
    try {
        const {user_id} = req;

        const { rows, page } = req.params;

        if (!rows || isNaN(Number(rows)) || Number(rows) <= 0)
            return failureResponse(res, 400, "Invalid rows");

        if (!page || isNaN(Number(page)) || Number(page) <= 0)
            return failureResponse(res, 400, "Invalid page");

        const admin = await getUserByCondition({user_id});
        if (!admin) return failureResponse(res, 404, "User not found");

        if (admin.status !== "ACTIVE")
            return failureResponse(res, 403, "User is not active");

        if (admin.role !== "ADMIN")
            return failureResponse(res, 403, "Forbidden");

        if (!admin.org_id || !admin.department_id)
            return failureResponse(res, 403, "Admin scope invalid");

        const { limit, offset } = getPaginationInfo(rows, page);

        // ✅ Just extend conditions
        const conditions = {
            org_id: admin.org_id,
            department_id: admin.department_id,
            assigned_to_user_id: null,   // 🔥 key addition
        };

        if (req.query.unassigned === "true") {
            conditions.assigned_to_user_id = null;
        }

        if (req.query.status) {
            conditions.status = req.query.status;
        }

        const result = await getDevices(limit, offset, conditions);

        return res.status(200).send({
            status: 200,
            data: result, // { count, rows }
        });

    } catch (err) {
        console.error("getDevicesNotAssignToTechnician error:", err);
        return res.status(500).send({
            status: 500,
            message: "Internal server error",
        });
    }
}


// TECHNICIAN 
export async function addTechnician(req, res) {
  try {
    const { user_id } = req;
    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    // ✅ 1) Validate admin
    const admin = await getUserByCondition({ user_id });
    if (!admin) return failureResponse(res, 404, "User not found");

    if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (admin.role !== constants.ADMIN) return failureResponse(res, 403, "Forbidden");

    if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");
    if (!admin.department_id) return failureResponse(res, 403, "Admin department not assigned");

    // ✅ 2) Whitelist body
    const raw = addData(req.body, constants.ADD_TECHNICIAN_ATTRIBUTES);

    // ✅ 3) Required checks
    if (!raw.username) return failureResponse(res, 400, "username is required");
    if (!raw.name) return failureResponse(res, 400, "name is required");
    if (!raw.phone) return failureResponse(res, 400, "phone is required");
    if (!raw.password) return failureResponse(res, 400, "password is required");

    // ✅ 4) Uniqueness checks
    const existingUsername = await getUserByCondition({ username: raw.username });
    if (existingUsername) return failureResponse(res, 409, "Username already exists");

    const existingPhone = await getUserByCondition({ phone: raw.phone });
    if (existingPhone) return failureResponse(res, 409, "Phone already exists");

    if (raw.email) {
      const existingEmail = await getUserByCondition({ email: raw.email });
      if (existingEmail) return failureResponse(res, 409, "Email already exists");
    }

    // ✅ 5) Hash password (store only password_hash)
    const password_hash = await hashPassword(raw.password);

    // ✅ 6) Build final payload (ignore any role/org/department from body)
    const payload = {
      username: raw.username,
      name: raw.name,
      email: raw.email || null,
      phone: raw.phone || null,
      password:password_hash,
      role: constants.TECHNICIAN,
      status: "INACTIVE",
      org_id: admin.org_id,
      department_id: admin.department_id,
    };

    const created = await createTechnician(payload);

    return res.status(201).send({
      status: 201,
      data: {
        user_id: created.user_id,
        username: created.username,
        name: created.name,
        email: created.email,
        phone: created.phone,
        role: created.role,
        org_id: created.org_id,
        department_id: created.department_id,
        status: created.status,
        created_at: created.created_at,
      },
      message: "Technician created successfully",
    });
  } catch (err) {
    console.error("addTechnician error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}


export async function assignDevice(req, res) {
  try {
    const { user_id } = req;
    const { device_id } = req.params;

    if (!device_id) return failureResponse(res, 400, "device_id is required");

    const admin = await getUserByCondition({ user_id });
    if (!admin) return failureResponse(res, 404, "User not found");
    if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (admin.role !== constants.ADMIN) return failureResponse(res, 403, "Forbidden");
    if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");
    if (!admin.department_id) return failureResponse(res, 403, "Admin department not assigned");

    const device = await getDeviceByIdFlat(device_id);
    if (!device) return failureResponse(res, 404, "Device not found");
    if (device.org_id !== admin.org_id) return failureResponse(res, 403, "Device not in your organization");
    if (device.department_id !== admin.department_id) return failureResponse(res, 403, "Device not in your department");

    const { technician_id } = req.body;

    if (technician_id) {
      const tech = await getUserByCondition({ user_id: technician_id });
      if (!tech) return failureResponse(res, 404, "Technician not found");
      if (tech.role !== constants.TECHNICIAN) return failureResponse(res, 400, "User is not a technician");
      if (tech.status === "REMOVED") return failureResponse(res, 400, "Technician has been removed from the organization");
      if (tech.org_id !== admin.org_id) return failureResponse(res, 403, "Technician not in your organization");
      if (tech.department_id !== admin.department_id) return failureResponse(res, 403, "Technician not in your department");
    }

    const updateData = {
      assigned_to_user_id: technician_id || null,
      assigned_by_user_id: technician_id ? admin.user_id : null,
      assigned_at: technician_id ? new Date() : null,
    };

    // Capture previous assignee before update
    const prev_tech_id = device.assigned_to_user_id;

    const updated = await assignDeviceToTechnician(device_id, updateData);

    // New assignee: if they're logged in (ACTIVE) → WORKING; if offline (INACTIVE) → stays INACTIVE
    if (technician_id) {
      const isOnline = await hasActiveToken(technician_id);
      if (isOnline) await setTechnicianWorking(technician_id);
    }

    // Previous assignee lost a device — check remaining
    if (prev_tech_id && prev_tech_id !== technician_id) {
      const remaining = await getDevicesByTechnician(prev_tech_id);
      if (remaining.length === 0) {
        const wasOnline = await hasActiveToken(prev_tech_id);
        // Online with no devices → ACTIVE; offline with no devices → INACTIVE
        if (wasOnline) await activateTechnician(prev_tech_id);
        else await inactivateTechnician(prev_tech_id);
      }
    }

    // Real-time: notify old technician their device was taken
    if (prev_tech_id && prev_tech_id !== technician_id) {
      emitToUser(prev_tech_id, "device:updated", { device_id, action: "unassigned" });
    }
    // Real-time: notify new technician they received a device
    if (technician_id) {
      emitToUser(technician_id, "device:updated", { device_id, action: "assigned" });
    }
    // Real-time: notify the admin's own socket so open screens can refresh
    emitToUser(admin.user_id, "devices:updated", { device_id });

    return res.status(200).send({
      status: 200,
      data: updated,
      message: technician_id ? "Device assigned successfully" : "Device unassigned successfully",
    });
  } catch (err) {
    console.error("assignDevice error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getAllTechnicians(req, res) {
  try {
    const { user_id } = req;
    if (!user_id) return failureResponse(res, 401, "Unauthorized");

    const { rows, page } = req.params;

    if (!rows || isNaN(Number(rows)) || Number(rows) <= 0)
      return failureResponse(res, 400, "Invalid rows");

    if (!page || isNaN(Number(page)) || Number(page) <= 0)
      return failureResponse(res, 400, "Invalid page");

    const admin = await getUserByCondition({ user_id });
    if (!admin) return failureResponse(res, 404, "User not found");

    if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (admin.role !== constants.ADMIN) return failureResponse(res, 403, "Forbidden");

    if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");
    if (!admin.department_id) return failureResponse(res, 403, "Admin department not assigned");

    const { limit, offset } = getPaginationInfo(rows, page);

    const conditions = {
      org_id: admin.org_id,
      department_id: admin.department_id,
      role: constants.TECHNICIAN,
    };
    // getTechnicians
    const result = await getUsers(limit, offset, conditions);

    return res.status(200).send({
      status: 200,
      data: result, // { count, rows }
    });
  } catch (err) {
    console.error("getAllTechnicians error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function addDevice(req, res) {
  try {
    const { user_id } = req;

    const admin = await getUserByCondition({ user_id });
    if (!admin) return failureResponse(res, 404, "User not found");
    if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (admin.role !== constants.ADMIN) return failureResponse(res, 403, "Forbidden");
    if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");
    if (!admin.department_id) return failureResponse(res, 403, "Admin department not assigned");

    const raw = addData(req.body, constants.ADD_DEVICE_ATTRIBUTES);

    if (!raw.device_id) return failureResponse(res, 400, "device_id is required");
    if (!raw.serial_no) return failureResponse(res, 400, "serial_no is required");
    if (!raw.model) return failureResponse(res, 400, "model is required");

    const existing = await getDeviceByIdFlat(raw.device_id);
    if (existing) return failureResponse(res, 409, "Device ID already exists");

    const device = await createDevice({
      device_id: raw.device_id,
      serial_no: raw.serial_no,
      model: raw.model,
      status: "ACTIVE",
      org_id: admin.org_id,
      department_id: admin.department_id,
    });

    return res.status(201).send({
      status: 201,
      data: { device_id: device.device_id, serial_no: device.serial_no, model: device.model, status: device.status },
      message: "Device added successfully",
    });
  } catch (err) {
    console.error("addDevice error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getTechnicianDetail(req, res) {
  try {
    const { user_id } = req;
    const { technician_id } = req.params;

    const admin = await getUserByCondition({ user_id });
    if (!admin) return failureResponse(res, 404, "User not found");
    if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (admin.role !== constants.ADMIN) return failureResponse(res, 403, "Forbidden");
    if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");

    const tech = await getUserByCondition({ user_id: technician_id });
    if (!tech) return failureResponse(res, 404, "Technician not found");
    if (tech.role !== constants.TECHNICIAN) return failureResponse(res, 400, "User is not a technician");
    if (tech.org_id !== admin.org_id) return failureResponse(res, 403, "Technician not in your organization");

    const [devices, sessionCount] = await Promise.all([
      getDevicesByTechnician(technician_id),
      getSessionCountByTechnician(technician_id),
    ]);

    return res.status(200).send({
      status: 200,
      data: {
        user_id: tech.user_id,
        name: tech.name,
        username: tech.username,
        email: tech.email,
        phone: tech.phone,
        status: tech.status,
        created_at: tech.created_at,
        devices,
        session_count: sessionCount,
      },
    });
  } catch (err) {
    console.error("getTechnicianDetail error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function removeTechnician(req, res) {
  try {
    const { user_id } = req;
    const { technician_id } = req.params;

    const admin = await getUserByCondition({ user_id });
    if (!admin) return failureResponse(res, 404, "User not found");
    if (admin.status !== "ACTIVE") return failureResponse(res, 403, "User is not active");
    if (admin.role !== constants.ADMIN) return failureResponse(res, 403, "Forbidden");
    if (!admin.org_id) return failureResponse(res, 403, "Admin org not assigned");

    const tech = await getUserByCondition({ user_id: technician_id });
    if (!tech) return failureResponse(res, 404, "Technician not found");
    if (tech.role !== constants.TECHNICIAN) return failureResponse(res, 400, "User is not a technician");
    if (tech.org_id !== admin.org_id) return failureResponse(res, 403, "Technician not in your organization");

    await unassignDevicesByTechnician(technician_id);
    await deactivateTechnician(technician_id);

    // Real-time: notify the removed technician
    emitToUser(technician_id, "user:deactivated", { reason: "Removed by admin" });

    return res.status(200).send({
      status: 200,
      message: "Technician removed from organization",
    });
  } catch (err) {
    console.error("removeTechnician error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

// ── Patient management (Admin) ─────────────────────────────────────────────────

async function getAdminContext(user_id, res) {
  const admin = await getUserByCondition({ user_id });
  if (!admin) { failureResponse(res, 404, "User not found"); return null; }
  if (admin.status !== "ACTIVE") { failureResponse(res, 403, "User is not active"); return null; }
  if (admin.role !== constants.ADMIN) { failureResponse(res, 403, "Forbidden"); return null; }
  if (!admin.org_id) { failureResponse(res, 403, "Admin org not assigned"); return null; }
  return admin;
}

export async function getAllPatientsAdmin(req, res) {
  try {
    const { user_id } = req;
    const { rows, page } = req.params;
    if (!rows || isNaN(Number(rows)) || Number(rows) <= 0) return failureResponse(res, 400, "Invalid rows");
    if (!page || isNaN(Number(page)) || Number(page) <= 0) return failureResponse(res, 400, "Invalid page");

    const admin = await getAdminContext(user_id, res);
    if (!admin) return;

    const { limit, offset } = getPaginationInfo(rows, page);
    const patients = await getPatients(limit, offset, { org_id: admin.org_id });
    return res.status(200).send({ status: 200, data: patients });
  } catch (err) {
    console.error("getAllPatientsAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getPatientByIdAdmin(req, res) {
  try {
    const { user_id } = req;
    const { patient_id } = req.params;
    if (!patient_id) return failureResponse(res, 400, "patient_id required");

    const admin = await getAdminContext(user_id, res);
    if (!admin) return;

    const patient = await getPatientByIdFlat({ patient_id });
    if (!patient) return failureResponse(res, 404, "Patient not found");
    if (patient.org_id !== admin.org_id) return failureResponse(res, 403, "Access denied");

    return res.status(200).send({ status: 200, data: patient });
  } catch (err) {
    console.error("getPatientByIdAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function addPatientAdmin(req, res) {
  try {
    const { user_id } = req;
    const admin = await getAdminContext(user_id, res);
    if (!admin) return;

    const raw = req.body || {};
    if (!raw.name || raw.name.trim() === "") return failureResponse(res, 400, "Patient name is required");

    const filteredData = addData(raw, constants.ADD_PATIENT_ATTRIBUTES);
    const created = await createPatient({
      ...filteredData,
      org_id: admin.org_id,
      created_by: admin.user_id,
    });

    return res.status(201).send({ status: 201, data: created, message: "Patient created successfully" });
  } catch (err) {
    console.error("addPatientAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function updatePatientAdmin(req, res) {
  try {
    const { user_id } = req;
    const { patient_id } = req.params;
    if (!patient_id) return failureResponse(res, 400, "patient_id required");

    const admin = await getAdminContext(user_id, res);
    if (!admin) return;

    const patient = await getPatientByIdFlat({ patient_id });
    if (!patient) return failureResponse(res, 404, "Patient not found");
    if (patient.org_id !== admin.org_id) return failureResponse(res, 403, "Access denied");

    const raw = req.body || {};
    const filteredData = addData(raw, constants.UPDATE_PATIENT_ATTRIBUTES);
    if (Object.keys(filteredData).length === 0) return failureResponse(res, 400, "No updatable fields provided");

    const updated = await updatePatient(patient_id, filteredData);
    if (!updated) return failureResponse(res, 500, "Failed to update patient");

    return res.status(200).send({ status: 200, data: updated, message: "Patient updated successfully" });
  } catch (err) {
    console.error("updatePatientAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getPatientTestsAdmin(req, res) {
  try {
    const { user_id } = req;
    const { patient_id, rows, page } = req.params;
    if (!patient_id) return failureResponse(res, 400, "patient_id required");
    if (!rows || isNaN(Number(rows)) || Number(rows) <= 0) return failureResponse(res, 400, "Invalid rows");
    if (!page || isNaN(Number(page)) || Number(page) <= 0) return failureResponse(res, 400, "Invalid page");

    const admin = await getAdminContext(user_id, res);
    if (!admin) return;

    const patient = await getPatientByIdFlat({ patient_id });
    if (!patient) return failureResponse(res, 404, "Patient not found");
    if (patient.org_id !== admin.org_id) return failureResponse(res, 403, "Access denied");

    const { limit, offset } = getPaginationInfo(rows, page);
    const history = await getPatientTestHistory(limit, offset, { patient_id, org_id: admin.org_id });
    return res.status(200).send({ status: 200, data: history });
  } catch (err) {
    console.error("getPatientTestsAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function getSessionReportAdmin(req, res) {
  try {
    const { user_id } = req;
    const { history_id } = req.params;
    if (!history_id) return failureResponse(res, 400, "history_id required");

    const admin = await getAdminContext(user_id, res);
    if (!admin) return;

    const session = await getTestSessionFlat(history_id);
    if (!session) return failureResponse(res, 404, "Session not found");
    if (session.org_id !== admin.org_id) return failureResponse(res, 403, "Access denied");

    const pdfBuffer = await generateSessionReportPdf(session);
    const pdf_base64 = pdfBuffer.toString("base64");
    return res.status(200).send({ status: 200, data: { pdf_base64 } });
  } catch (err) {
    console.error("getSessionReportAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

// ── Analytics ─────────────────────────────────────────────────────────────────

/** GET /admin/analytics/overview — KPI cards */
export async function getAnalyticsOverviewAdmin(req, res) {
  try {
    const admin = await getAdminContext(req.user_id, res);
    if (!admin) return;
    const data = await getAnalyticsOverview(admin.org_id);
    return res.status(200).send({ status: 200, data });
  } catch (err) {
    console.error("getAnalyticsOverviewAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

/** GET /admin/analytics/charts — all chart datasets in one call, optionally date-filtered */
export async function getAnalyticsChartsAdmin(req, res) {
  try {
    const admin = await getAdminContext(req.user_id, res);
    if (!admin) return;
    const org_id = admin.org_id;

    const IST = 'Asia/Kolkata';
    const { startDate: rawStart, endDate: rawEnd } = req.query;

    const startMoment = rawStart
      ? moment.tz(rawStart, 'YYYY-MM-DD', IST).startOf('day')
      : moment.tz(IST).subtract(30, 'days').startOf('day');
    const endMoment = rawEnd
      ? moment.tz(rawEnd, 'YYYY-MM-DD', IST).endOf('day')
      : moment.tz(IST).endOf('day');

    const startDate = startMoment.toISOString();
    const endDate   = endMoment.toISOString();

    const settle = fn => fn.then(v => v).catch(err => { console.error("Analytics query failed:", err.message); return []; });

    const [
      session_status,
      daily_tests,
      tests_per_device,
      test_type_distribution,
      abnormal_rates,
      weekly_patients,
      technician_activity,
      patient_gender,
    ] = await Promise.all([
      settle(getAnalyticsSessionStatus(org_id, startDate, endDate)),
      settle(getAnalyticsDailyTests(org_id, startDate, endDate)),
      settle(getAnalyticsTestsPerDevice(org_id, startDate, endDate)),
      settle(getAnalyticsTestTypeDistribution(org_id, startDate, endDate)),
      settle(getAnalyticsAbnormalRates(org_id, startDate, endDate)),
      settle(getAnalyticsWeeklyPatients(org_id, startDate, endDate)),
      settle(getAnalyticsTechnicianActivity(org_id, startDate, endDate)),
      settle(getAnalyticsPatientGender(org_id)),
    ]);

    return res.status(200).send({
      status: 200,
      data: {
        session_status,
        daily_tests,
        tests_per_device,
        test_type_distribution,
        abnormal_rates,
        weekly_patients,
        technician_activity,
        patient_gender,
      },
    });
  } catch (err) {
    console.error("getAnalyticsChartsAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

/** GET /admin/analytics/test-type-sessions — drill-down sessions for a test type */
export async function getTestTypeSessionsAdmin(req, res) {
  try {
    const admin = await getAdminContext(req.user_id, res);
    if (!admin) return;
    const org_id = admin.org_id;

    const IST = 'Asia/Kolkata';
    const { testTypeName, startDate: rawStart, endDate: rawEnd } = req.query;
    if (!testTypeName) return res.status(400).send({ status: 400, message: "testTypeName is required" });

    const startDate = rawStart
      ? moment.tz(rawStart, 'YYYY-MM-DD', IST).startOf('day').toISOString()
      : moment.tz(IST).subtract(30, 'days').startOf('day').toISOString();
    const endDate = rawEnd
      ? moment.tz(rawEnd, 'YYYY-MM-DD', IST).endOf('day').toISOString()
      : moment.tz(IST).endOf('day').toISOString();

    const sessions = await getAnalyticsTestTypeSessions(org_id, testTypeName, startDate, endDate);
    return res.status(200).send({ status: 200, data: sessions });
  } catch (err) {
    console.error("getTestTypeSessionsAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

// ── Admin test session routes ──────────────────────────────────────────────────
// Admin can register and perform tests just like a technician.
// entered_by_user_id will be the admin's user_id; their role (ADMIN) in the
// users table is what the front-end uses to show "performed by Admin".

export async function getTestTypesAdmin(req, res) {
  try {
    const admin = await getAdminContext(req.user_id, res);
    if (!admin) return;
    const types = await getTestTypesByOrg(admin.org_id);
    return res.status(200).send({ status: 200, data: types, message: "Test types" });
  } catch (err) {
    console.error("getTestTypesAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function registerTestSessionAdmin(req, res) {
  try {
    const admin = await getAdminContext(req.user_id, res);
    if (!admin) return;

    const { patient_id, test_date, device_id, notes, test_type_ids } = req.body || {};

    if (!patient_id)   return failureResponse(res, 400, "patient_id required");
    if (!test_date)    return failureResponse(res, 400, "test_date required");
    if (!Array.isArray(test_type_ids) || test_type_ids.length === 0)
      return failureResponse(res, 400, "test_type_ids array required");

    const patient = await getPatientByIdFlat({ patient_id });
    if (!patient) return failureResponse(res, 404, "Patient not found");
    if (patient.org_id !== admin.org_id) return failureResponse(res, 403, "Access denied");

    const validIds = await getOrgPlanTestTypeIds(test_type_ids, admin.org_id);
    if (validIds.size !== test_type_ids.length)
      return failureResponse(res, 400, "Invalid or unauthorized test type");

    const history = await createTestHistory({
      patient_id,
      org_id: admin.org_id,
      department_id: admin.department_id || null,
      device_id: device_id || null,
      entered_by_user_id: admin.user_id,
      test_date,
      notes: notes ?? null,
      status: "PENDING",
    });

    const insertData = test_type_ids.map(id => ({
      history_id:   history.history_id,
      patient_id,
      org_id:       admin.org_id,
      test_type_id: id,
      value_num:    null,
      value_text:   null,
    }));
    const results = await bulkCreatePatientTestResults(insertData);

    return res.status(201).send({
      status: 201,
      data: { history, results },
      message: "Test session registered successfully",
    });
  } catch (err) {
    console.error("registerTestSessionAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function completeTestSessionAdmin(req, res) {
  try {
    const admin = await getAdminContext(req.user_id, res);
    if (!admin) return;

    const { history_id } = req.params;
    if (!history_id) return failureResponse(res, 400, "history_id required");

    const { tests, notes, complete, device_id } = req.body || {};

    const session = await getTestSessionFlat(history_id);
    if (!session) return failureResponse(res, 404, "Session not found");
    if (session.org_id !== admin.org_id) return failureResponse(res, 403, "Access denied");
    if (session.status === "COMPLETED") return failureResponse(res, 400, "Session already completed");

    if (Array.isArray(tests) && tests.length > 0) {
      const filledTests = tests.filter(t =>
        t.value_num != null || (t.value_text != null && t.value_text !== "")
      );
      if (filledTests.length > 0) {
        await bulkUpdateTestResultsBySession(history_id, filledTests);
      }
    }

    const newStatus = complete === true ? "COMPLETED" : "PENDING";
    const historyUpdate = { status: newStatus };
    if (notes !== undefined) historyUpdate.notes = notes;
    // Lock device on first save — cannot be changed once set
    if (device_id && !session.device_id) historyUpdate.device_id = device_id;
    const updated = await updateTestHistoryDb(history_id, historyUpdate);

    return res.status(200).send({
      status: 200,
      data: updated,
      message: newStatus === "COMPLETED" ? "Test session completed" : "Test values saved",
    });
  } catch (err) {
    console.error("completeTestSessionAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function generateCsvReportAdmin(req, res) {
  try {
    const admin = await getAdminContext(req.user_id, res);
    if (!admin) return;

    const IST = "Asia/Kolkata";
    const { startDate: rawStart, endDate: rawEnd } = req.query;

    const startDate = rawStart
      ? moment.tz(rawStart, "YYYY-MM-DD", IST).startOf("day").toISOString()
      : moment.tz(IST).subtract(30, "days").startOf("day").toISOString();
    const endDate = rawEnd
      ? moment.tz(rawEnd, "YYYY-MM-DD", IST).endOf("day").toISOString()
      : moment.tz(IST).endOf("day").toISOString();

    const histories = await getResultsForCsvExport(admin.org_id, startDate, endDate);
    const org = await getOrgById(admin.org_id);
    const xlsxBuffer = await buildTestResultsXlsx(histories, {
      orgName:    org?.org_name || "EDHAA Diagnostic",
      orgAddress: org?.address  || "",
    });
    const xlsx_base64 = Buffer.from(xlsxBuffer).toString("base64");

    return res.status(200).send({
      status: 200,
      // data: { xlsx_base64, filename: `report_${rawStart || "all"}_to_${rawEnd || "today"}.xlsx` },
      data: { xlsx_base64, filename: `Test_Info.xlsx` },
      message: `${histories.length} sessions exported`,
    });
  } catch (err) {
    console.error("generateCsvReportAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}

export async function generatePdfReportAdmin(req, res) {
  try {
    const admin = await getAdminContext(req.user_id, res);
    if (!admin) return;

    const IST = "Asia/Kolkata";
    const { startDate: rawStart, endDate: rawEnd } = req.query;

    const startDate = rawStart
      ? moment.tz(rawStart, "YYYY-MM-DD", IST).startOf("day").toISOString()
      : moment.tz(IST).subtract(30, "days").startOf("day").toISOString();
    const endDate = rawEnd
      ? moment.tz(rawEnd, "YYYY-MM-DD", IST).endOf("day").toISOString()
      : moment.tz(IST).endOf("day").toISOString();

    const histories = await getResultsForCsvExport(admin.org_id, startDate, endDate);
    const org = await getOrgById(admin.org_id);

    const pdfBuffer = await generateBulkReportPdf(histories, {
      orgName:    org?.org_name || "EDHAA Diagnostic",
      orgAddress: org?.address  || "",
      deptName:   "",
      startDate:  rawStart || "all",
      endDate:    rawEnd   || "today",
    });

    const pdf_base64 = pdfBuffer.toString("base64");
    // const filename   = `report_${rawStart || "all"}_to_${rawEnd || "today"}.pdf`;
    const filename = `Test_Info.pdf`;

    return res.status(200).send({
      status: 200,
      data: { pdf_base64, filename },
      message: `${histories.length} sessions exported`,
    });
  } catch (err) {
    console.error("generatePdfReportAdmin error:", err);
    return res.status(500).send({ status: 500, message: "Internal server error" });
  }
}