import {
  addData,
  failureResponse,
  getPaginationInfo,
  hashPassword,
} from "../../utils.js";

import { constants } from "../../constants.js";

import {
  getUserByCondition,
  getUsers,
  createTechnician,
  getSuperAdminCounts,
  getOrganizations,
  getOrgById,
  createOrganization,
  updateOrganization as updateOrganizationDb,
  getAllTestTypes,
  getTestTypeById,
  updateTestType as updateTestTypeDb,
  getSuperAdminAnalytics,
} from "../../database/db.js";

async function getSuperAdminContext(user_id, res) {
  const user = await getUserByCondition({ user_id });

  if (!user) {
    failureResponse(res, 404, "User not found");
    return null;
  }

  if (user.status !== "ACTIVE") {
    failureResponse(res, 403, "User is not active");
    return null;
  }

  if (user.role !== constants.SUPER_ADMIN) {
    failureResponse(res, 403, "Forbidden");
    return null;
  }

  return user;
}

// Dashboard
export async function getSuperAdminDashboard(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const counts = await getSuperAdminCounts();

    return res.status(200).send({
      status: 200,
      data: counts,
      message: "Super admin dashboard",
    });
  } catch (err) {
    console.error("getSuperAdminDashboard error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

// Organizations
export async function getAllOrganizations(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { rows, page } = req.params;

    if (!rows || isNaN(Number(rows)) || Number(rows) <= 0) {
      return failureResponse(res, 400, "Invalid rows");
    }

    if (!page || isNaN(Number(page)) || Number(page) <= 0) {
      return failureResponse(res, 400, "Invalid page");
    }

    const { limit, offset } = getPaginationInfo(rows, page);
    const result = await getOrganizations(limit, offset);

    return res.status(200).send({
      status: 200,
      data: result,
    });
  } catch (err) {
    console.error("getAllOrganizations error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function getOrganizationById(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { org_id } = req.params;

    if (!org_id) {
      return failureResponse(res, 400, "org_id is required");
    }

    const organization = await getOrgById(org_id);

    if (!organization) {
      return failureResponse(res, 404, "Organization not found");
    }

    return res.status(200).send({
      status: 200,
      data: organization,
    });
  } catch (err) {
    console.error("getOrganizationById error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function addOrganization(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const raw = req.body || {};

    if (!raw.org_name) {
      return failureResponse(res, 400, "org_name is required");
    }

    const payload = {
      org_name: raw.org_name,
      code: raw.code || raw.org_code || null,
      address: raw.address || null,
      status: raw.status || "ACTIVE",
      plan_id: raw.plan_id || null,
    };

    const created = await createOrganization(payload);

    return res.status(201).send({
      status: 201,
      data: created,
      message: "Organization created successfully",
    });
  } catch (err) {
    console.error("addOrganization error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function updateOrganization(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { org_id } = req.params;

    if (!org_id) {
      return failureResponse(res, 400, "org_id is required");
    }

    const organization = await getOrgById(org_id);

    if (!organization) {
      return failureResponse(res, 404, "Organization not found");
    }

    const raw = req.body || {};

    const payload = {};

    if (raw.org_name !== undefined) payload.org_name = raw.org_name;
    if (raw.code !== undefined) payload.code = raw.code;
    if (raw.org_code !== undefined) payload.code = raw.org_code;
    if (raw.address !== undefined) payload.address = raw.address;
    if (raw.status !== undefined) payload.status = raw.status;
    if (raw.plan_id !== undefined) payload.plan_id = raw.plan_id;

    if (Object.keys(payload).length === 0) {
      return failureResponse(res, 400, "No updatable fields provided");
    }

    const updated = await updateOrganizationDb(org_id, payload);

    return res.status(200).send({
      status: 200,
      data: updated,
      message: "Organization updated successfully",
    });
  } catch (err) {
    console.error("updateOrganization error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

// Technicians
export async function getAllTechniciansSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { rows, page } = req.params;

    if (!rows || isNaN(Number(rows)) || Number(rows) <= 0) {
      return failureResponse(res, 400, "Invalid rows");
    }

    if (!page || isNaN(Number(page)) || Number(page) <= 0) {
      return failureResponse(res, 400, "Invalid page");
    }

    const { limit, offset } = getPaginationInfo(rows, page);

    const result = await getUsers(limit, offset, {
      role: constants.TECHNICIAN,
    });

    return res.status(200).send({
      status: 200,
      data: result,
    });
  } catch (err) {
    console.error("getAllTechniciansSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function getTechnicianByIdSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { technician_id } = req.params;

    if (!technician_id) {
      return failureResponse(res, 400, "technician_id is required");
    }

    const technician = await getUserByCondition({
      user_id: technician_id,
    });

    if (!technician) {
      return failureResponse(res, 404, "Technician not found");
    }

    if (technician.role !== constants.TECHNICIAN) {
      return failureResponse(res, 400, "User is not a technician");
    }

    return res.status(200).send({
      status: 200,
      data: technician,
    });
  } catch (err) {
    console.error("getTechnicianByIdSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function addTechnicianSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const raw = addData(req.body, [
      "username",
      "name",
      "email",
      "phone",
      "password",
      "org_id",
      "department_id",
      "status",
    ]);

    if (!raw.username) return failureResponse(res, 400, "username is required");
    if (!raw.name) return failureResponse(res, 400, "name is required");
    if (!raw.phone) return failureResponse(res, 400, "phone is required");
    if (!raw.password) return failureResponse(res, 400, "password is required");
    if (!raw.org_id) return failureResponse(res, 400, "org_id is required");

    const organization = await getOrgById(raw.org_id);
    if (!organization) return failureResponse(res, 404, "Organization not found");

    const existingUsername = await getUserByCondition({
      username: raw.username,
    });

    if (existingUsername) {
      return failureResponse(res, 409, "Username already exists");
    }

    const existingPhone = await getUserByCondition({
      phone: raw.phone,
    });

    if (existingPhone) {
      return failureResponse(res, 409, "Phone already exists");
    }

    if (raw.email) {
      const existingEmail = await getUserByCondition({
        email: raw.email,
      });

      if (existingEmail) {
        return failureResponse(res, 409, "Email already exists");
      }
    }

    const password_hash = await hashPassword(raw.password);

    const payload = {
      username: raw.username,
      name: raw.name,
      email: raw.email || null,
      phone: raw.phone || null,
      password: password_hash,
      role: constants.TECHNICIAN,
      status: raw.status || "INACTIVE",
      org_id: raw.org_id,
      department_id: raw.department_id || null,
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
        status: created.status,
        org_id: created.org_id,
        department_id: created.department_id,
        created_at: created.created_at,
      },
      message: "Technician created successfully",
    });
  } catch (err) {
    console.error("addTechnicianSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function updateTechnicianSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { technician_id } = req.params;

    if (!technician_id) {
      return failureResponse(res, 400, "technician_id is required");
    }

    const technician = await getUserByCondition({
      user_id: technician_id,
    });

    if (!technician) {
      return failureResponse(res, 404, "Technician not found");
    }

    if (technician.role !== constants.TECHNICIAN) {
      return failureResponse(res, 400, "User is not a technician");
    }

    const raw = req.body || {};

    const payload = {};

    if (raw.name !== undefined) payload.name = raw.name;
    if (raw.email !== undefined) payload.email = raw.email;
    if (raw.phone !== undefined) payload.phone = raw.phone;
    if (raw.status !== undefined) payload.status = raw.status;
    if (raw.org_id !== undefined) payload.org_id = raw.org_id;
    if (raw.department_id !== undefined) payload.department_id = raw.department_id;

    if (raw.password) {
      payload.password = await hashPassword(raw.password);
    }

    if (Object.keys(payload).length === 0) {
      return failureResponse(res, 400, "No updatable fields provided");
    }

    const { updateUser } = await import("../../database/db.js");
    const updated = await updateUser(technician_id, payload);

    return res.status(200).send({
      status: 200,
      data: updated,
      message: "Technician updated successfully",
    });
  } catch (err) {
    console.error("updateTechnicianSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

// Tests
export async function getAllTestsSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { rows, page } = req.params;

    if (!rows || isNaN(Number(rows)) || Number(rows) <= 0) {
      return failureResponse(res, 400, "Invalid rows");
    }

    if (!page || isNaN(Number(page)) || Number(page) <= 0) {
      return failureResponse(res, 400, "Invalid page");
    }

    const { limit, offset } = getPaginationInfo(rows, page);
    const result = await getAllTestTypes(limit, offset);

    return res.status(200).send({
      status: 200,
      data: result,
    });
  } catch (err) {
    console.error("getAllTestsSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function getTestByIdSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { test_type_id } = req.params;

    if (!test_type_id) {
      return failureResponse(res, 400, "test_type_id is required");
    }

    const test = await getTestTypeById(test_type_id);

    if (!test) {
      return failureResponse(res, 404, "Test not found");
    }

    return res.status(200).send({
      status: 200,
      data: test,
    });
  } catch (err) {
    console.error("getTestByIdSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function updateTestSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { test_type_id } = req.params;

    if (!test_type_id) {
      return failureResponse(res, 400, "test_type_id is required");
    }

    const test = await getTestTypeById(test_type_id);

    if (!test) {
      return failureResponse(res, 404, "Test not found");
    }

    const raw = req.body || {};

    const payload = {};

    [
      "name",
      "full_name",
      "unit",
      "normal_min",
      "normal_max",
      "male_min",
      "male_max",
      "female_min",
      "female_max",
      "category",
      "method",
      "method_options",
      "reference_text",
      "critical_low",
      "critical_high",
      "is_qualitative",
      "specimen_type",
    ].forEach((key) => {
      if (raw[key] !== undefined) {
        payload[key] = raw[key];
      }
    });

    if (Object.keys(payload).length === 0) {
      return failureResponse(res, 400, "No updatable fields provided");
    }

    const updated = await updateTestTypeDb(test_type_id, payload);

    return res.status(200).send({
      status: 200,
      data: updated,
      message: "Test updated successfully",
    });
  } catch (err) {
    console.error("updateTestSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function getSuperAdminAnalyticsData(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const data = await getSuperAdminAnalytics();

    return res.status(200).send({
      status: 200,
      data,
      message: "Super admin analytics",
    });
  } catch (err) {
    console.error("getSuperAdminAnalyticsData error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}