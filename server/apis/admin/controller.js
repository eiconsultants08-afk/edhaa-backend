// controller.js
import { addData, failureResponse, getPaginationInfo, hashPassword } from "../../utils.js";
import { createTechnician, getDeviceByIdFlat, getDevices, getUserByCondition } from "../../database/db.js";
import { constants } from "../../constants.js";



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
    if (!raw.email) return failureResponse(res, 400, "email is required");
    if (!raw.password) return failureResponse(res, 400, "password is required");

    // ✅ 4) Uniqueness checks
    const existingUsername = await getUserByCondition({ username: raw.username });
    if (existingUsername) return failureResponse(res, 409, "Username already exists");

    const existingEmail = await getUserByCondition({ email: raw.email });
    if (existingEmail) return failureResponse(res, 409, "Email already exists");

    if (raw.phone) {
      const existingPhone = await getUserByCondition({ phone: raw.phone });
      if (existingPhone) return failureResponse(res, 409, "Phone already exists");
    }

    // ✅ 5) Hash password (store only password_hash)
    const password_hash = await hashPassword(raw.password);

    // ✅ 6) Build final payload (ignore any role/org/department from body)
    const payload = {
      username: raw.username,
      name: raw.name,
      email: raw.email,
      phone: raw.phone || null,
      password:password_hash,
      role: constants.TECHNICIAN,
      status: "ACTIVE",
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