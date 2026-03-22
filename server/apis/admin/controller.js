// controller.js
import { addData, failureResponse, getPaginationInfo, hashPassword } from "../../utils.js";
import { activateTechnician, inactivateTechnician, setTechnicianWorking, hasActiveToken, assignDeviceToTechnician, createDevice, createTechnician, deactivateTechnician, getDeviceByIdFlat, getDevices, getDevicesByTechnician, getSessionCountByTechnician, getUsers, getUserByCondition, unassignDevicesByTechnician, getPatients, getPatientByIdFlat, createPatient, updatePatient, getPatientTestHistory, getTestSessionFlat } from "../../database/db.js";
import { constants } from "../../constants.js";
import { emitToUser } from "../../socket.js";
import { generateSessionReportPdf } from "../../pdf/reportGenerator.js";



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