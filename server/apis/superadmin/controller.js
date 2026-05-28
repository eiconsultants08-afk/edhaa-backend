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
  getPlans,
  getPlanById,
  createPlan,
  updatePlan as updatePlanDb,
  replacePlanTestTypes,
  getTestTypesByIds,
  updateUser,
  getSuperAdminDeviceById,
  getSuperAdminDevices,
  createSuperAdminDevice,
  updateSuperAdminDevice,
  createTestType,
} from "../../database/db.js";
import sequelize from "../../database/connectdb.js";

async function getSuperAdminContext(user_id, res) {
  const user = await getUserByCondition({ user_id });

  if (!user) {
    failureResponse(res, 404, "User not found");
    return null;
  }

  // if (user.status !== "ACTIVE") {
  //   failureResponse(res, 403, "User is not active");
  //   return null;
  // }
  if (!["ACTIVE", "WORKING"].includes(user.status)) {
    return res.status(403).send({
      status: 403,
      message: "User is not active"
    });
  }

  if (user.role !== constants.SUPER_ADMIN) {
    failureResponse(res, 403, "Forbidden");
    return null;
  }

  return user;
}

function buildPlanConfigFromTests(selectedTests = []) {
  const specimenTypes = new Set();
  const bloodTests = [];
  const urineTests = [];
  const salivaTests = [];

  selectedTests.forEach((test) => {
    const specimen = test.specimen_type;
    const testName = test.name;

    if (!testName) return;

    if (specimen) specimenTypes.add(specimen);

    if (specimen === "Blood") bloodTests.push(testName);
    if (specimen === "Urine") urineTests.push(testName);
    if (specimen === "Saliva") salivaTests.push(testName);
  });

  return {
    all_tests: false,
    allowed_specimen_types: Array.from(specimenTypes),
    allowed_blood_tests: bloodTests,
    allowed_urine_tests: urineTests,
    allowed_saliva_tests: salivaTests,
  };
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


export async function getAllPlansSuperAdmin(req, res) {
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
    const result = await getPlans(limit, offset);

    return res.status(200).send({
      status: 200,
      data: result,
    });
  } catch (err) {
    console.error("getAllPlansSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function getPlanByIdSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { plan_id } = req.params;

    if (!plan_id) {
      return failureResponse(res, 400, "plan_id is required");
    }

    const plan = await getPlanById(plan_id);

    if (!plan) {
      return failureResponse(res, 404, "Plan not found");
    }

    return res.status(200).send({
      status: 200,
      data: plan,
    });
  } catch (err) {
    console.error("getPlanByIdSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function addPlanSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const raw = req.body || {};

    if (!raw.name) return failureResponse(res, 400, "name is required");
    if (!raw.tier) return failureResponse(res, 400, "tier is required");
    if (!raw.display_name) {
      return failureResponse(res, 400, "display_name is required");
    }

    const testTypeIds = Array.isArray(raw.test_type_ids)
      ? raw.test_type_ids
      : [];

    const selectedTests = testTypeIds.length
      ? await getTestTypesByIds(testTypeIds)
      : [];

    const config = buildPlanConfigFromTests(selectedTests);

    const created = await createPlan({
      name: raw.name,
      tier: raw.tier,
      display_name: raw.display_name,
      description: raw.description || null,
      config,
    });

    await replacePlanTestTypes(created.plan_id, testTypeIds);

    return res.status(201).send({
      status: 201,
      data: created,
      message: "Plan created successfully",
    });
  } catch (err) {
    console.error("addPlanSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: err.message || "Internal server error",
    });
  }
}

export async function updatePlanSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { plan_id } = req.params;

    if (!plan_id) {
      return failureResponse(res, 400, "plan_id is required");
    }

    const existingPlan = await getPlanById(plan_id);

    if (!existingPlan) {
      return failureResponse(res, 404, "Plan not found");
    }

    const raw = req.body || {};
    const payload = {};

    if (raw.name !== undefined) payload.name = raw.name;
    if (raw.tier !== undefined) payload.tier = raw.tier;
    if (raw.display_name !== undefined) payload.display_name = raw.display_name;
    if (raw.description !== undefined) payload.description = raw.description;

    if (Array.isArray(raw.test_type_ids)) {
      const selectedTests = raw.test_type_ids.length
        ? await getTestTypesByIds(raw.test_type_ids)
        : [];

      payload.config = buildPlanConfigFromTests(selectedTests);

      await replacePlanTestTypes(plan_id, raw.test_type_ids);
    }

    if (Object.keys(payload).length === 0) {
      return failureResponse(res, 400, "No updatable fields provided");
    }

    const updated = await updatePlanDb(plan_id, payload);

    return res.status(200).send({
      status: 200,
      data: updated,
      message: "Plan updated successfully",
    });
  } catch (err) {
    console.error("updatePlanSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: err.message || "Internal server error",
    });
  }
}

// Admins
export async function getAllAdminsSuperAdmin(req, res) {
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
      role: constants.ADMIN,
    });

    return res.status(200).send({
      status: 200,
      data: result,
    });
  } catch (err) {
    console.error("getAllAdminsSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function getAdminByIdSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { admin_id } = req.params;

    if (!admin_id) {
      return failureResponse(res, 400, "admin_id is required");
    }

    const admin = await getUserByCondition({
      user_id: admin_id,
    });

    if (!admin) {
      return failureResponse(res, 404, "Admin not found");
    }

    if (admin.role !== constants.ADMIN) {
      return failureResponse(res, 400, "User is not an admin");
    }

    return res.status(200).send({
      status: 200,
      data: admin,
    });
  } catch (err) {
    console.error("getAdminByIdSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function addAdminSuperAdmin(req, res) {
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
      "status",
    ]);

    if (!raw.username) return failureResponse(res, 400, "username is required");
    if (!raw.name) return failureResponse(res, 400, "name is required");
    if (!raw.phone) return failureResponse(res, 400, "phone is required");
    if (!raw.password) return failureResponse(res, 400, "password is required");
    if (!raw.org_id) return failureResponse(res, 400, "org_id is required");

    const organization = await getOrgById(raw.org_id);
    if (!organization) return failureResponse(res, 404, "Organization not found");

    const existingUsername = await getUserByCondition({ username: raw.username });
    if (existingUsername) return failureResponse(res, 409, "Username already exists");

    const existingPhone = await getUserByCondition({ phone: raw.phone });
    if (existingPhone) return failureResponse(res, 409, "Phone already exists");

    if (raw.email) {
      const existingEmail = await getUserByCondition({ email: raw.email });
      if (existingEmail) return failureResponse(res, 409, "Email already exists");
    }

    const password_hash = await hashPassword(raw.password);

    const payload = {
      username: raw.username,
      name: raw.name,
      email: raw.email || null,
      phone: raw.phone || null,
      password: password_hash,
      role: constants.ADMIN,
      status: raw.status || "INACTIVE",
      org_id: raw.org_id,
      department_id: null,
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
        created_at: created.created_at,
      },
      message: "Admin created successfully",
    });
  } catch (err) {
    console.error("addAdminSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function updateAdminSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { admin_id } = req.params;

    if (!admin_id) {
      return failureResponse(res, 400, "admin_id is required");
    }

    const admin = await getUserByCondition({
      user_id: admin_id,
    });

    if (!admin) {
      return failureResponse(res, 404, "Admin not found");
    }

    if (admin.role !== constants.ADMIN) {
      return failureResponse(res, 400, "User is not an admin");
    }

    const raw = req.body || {};
    const payload = {};

    if (raw.name !== undefined) payload.name = raw.name;
    if (raw.email !== undefined) payload.email = raw.email;
    if (raw.phone !== undefined) payload.phone = raw.phone;
    if (raw.status !== undefined) payload.status = raw.status;
    if (raw.org_id !== undefined) payload.org_id = raw.org_id;

    if (raw.password) {
      payload.password = await hashPassword(raw.password);
    }

    if (Object.keys(payload).length === 0) {
      return failureResponse(res, 400, "No updatable fields provided");
    }

    const updated = await updateUser(admin_id, payload);

    return res.status(200).send({
      status: 200,
      data: updated,
      message: "Admin updated successfully",
    });
  } catch (err) {
    console.error("updateAdminSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

// Devices
export async function getAllDevicesSuperAdmin(req, res) {
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
    const result = await getSuperAdminDevices(limit, offset);

    return res.status(200).send({
      status: 200,
      data: result,
    });
  } catch (err) {
    console.error("getAllDevicesSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function getDeviceByIdSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { device_id } = req.params;

    if (!device_id) {
      return failureResponse(res, 400, "device_id is required");
    }

    const device = await getSuperAdminDeviceById(device_id);

    if (!device) {
      return failureResponse(res, 404, "Device not found");
    }

    return res.status(200).send({
      status: 200,
      data: device,
    });
  } catch (err) {
    console.error("getDeviceByIdSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function addDeviceSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const raw = req.body || {};

    if (!raw.device_id) {
      return failureResponse(res, 400, "device_id is required");
    }

    if (!raw.serial_no) {
      return failureResponse(res, 400, "serial_no is required");
    }

    if (!raw.model) {
      return failureResponse(res, 400, "model is required");
    }

    if (!raw.org_id) {
      return failureResponse(res, 400, "org_id is required");
    }

    const organization = await getOrgById(raw.org_id);
    if (!organization) {
      return failureResponse(res, 404, "Organization not found");
    }

    const existingDevice = await getSuperAdminDeviceById(raw.device_id);
    if (existingDevice) {
      return failureResponse(res, 409, "Device already exists");
    }

    const payload = {
      device_id: raw.device_id,
      org_id: raw.org_id,
      serial_no: raw.serial_no,
      model: raw.model,
      status: raw.status || "ACTIVE",
      firmware_version: raw.firmware_version || null,
      assigned_to_user_id: raw.assigned_to_user_id || null,
      assigned_by_user_id: req.user_id,
      assigned_at: raw.assigned_to_user_id ? new Date() : null,
      department_id: raw.department_id || null,
    };

    const created = await createSuperAdminDevice(payload);

    return res.status(201).send({
      status: 201,
      data: created,
      message: "Device created successfully",
    });
  } catch (err) {
    console.error("addDeviceSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function updateDeviceSuperAdmin(req, res) {
  try {
    const superAdmin = await getSuperAdminContext(req.user_id, res);
    if (!superAdmin) return;

    const { device_id } = req.params;

    if (!device_id) {
      return failureResponse(res, 400, "device_id is required");
    }

    const device = await getSuperAdminDeviceById(device_id);

    if (!device) {
      return failureResponse(res, 404, "Device not found");
    }

    const raw = req.body || {};
    const payload = {};

    if (raw.org_id !== undefined) payload.org_id = raw.org_id;
    if (raw.serial_no !== undefined) payload.serial_no = raw.serial_no;
    if (raw.model !== undefined) payload.model = raw.model;
    if (raw.status !== undefined) payload.status = raw.status;
    if (raw.firmware_version !== undefined) {
      payload.firmware_version = raw.firmware_version;
    }
    if (raw.department_id !== undefined) payload.department_id = raw.department_id;

    if (raw.assigned_to_user_id !== undefined) {
      payload.assigned_to_user_id = raw.assigned_to_user_id || null;
      payload.assigned_by_user_id = req.user_id;
      payload.assigned_at = raw.assigned_to_user_id ? new Date() : null;
    }

    if (Object.keys(payload).length === 0) {
      return failureResponse(res, 400, "No updatable fields provided");
    }

    const updated = await updateSuperAdminDevice(device_id, payload);

    return res.status(200).send({
      status: 200,
      data: updated,
      message: "Device updated successfully",
    });
  } catch (err) {
    console.error("updateDeviceSuperAdmin error:", err);
    return res.status(500).send({
      status: 500,
      message: "Internal server error",
    });
  }
}

export async function addTestSuperAdmin(req, res) {
  try {
    const {
      name,
      full_name,
      unit,
      method,
      normal_min,
      normal_max,
      male_min,
      male_max,
      female_min,
      female_max,
      category,
      reference_text,
      critical_low,
      critical_high,
      is_qualitative,
      specimen_type,
    } = req.body;

    if (!name || name.trim() === "") {
      return failureResponse(res, 400, "Short name is required");
    }

    if (!unit || unit.trim() === "") {
      return failureResponse(res, 400, "Unit is required");
    }

    const created = await createTestType({
      name: name.trim(),
      full_name: full_name || null,
      unit: unit.trim(),
      method: method || null,

      normal_min: normal_min === "" ? null : normal_min,
      normal_max: normal_max === "" ? null : normal_max,

      male_min: male_min === "" ? null : male_min,
      male_max: male_max === "" ? null : male_max,

      female_min: female_min === "" ? null : female_min,
      female_max: female_max === "" ? null : female_max,

      category: category || null,
      reference_text: reference_text || null,

      critical_low: critical_low === "" ? null : critical_low,
      critical_high: critical_high === "" ? null : critical_high,

      is_qualitative: is_qualitative === true,
      specimen_type: specimen_type || null,
    });

    return res.status(201).send({
      success: true,
      status: 201,
      data: created,
      message: "Test created successfully",
    });
  } catch (err) {
    console.error("addTestSuperAdmin error:", err);

    if (err?.name === "SequelizeUniqueConstraintError") {
      return failureResponse(res, 409, "Test short name already exists");
    }

    return res.status(500).send({
      success: false,
      status: 500,
      message: "Internal server error",
    });
  }
}

export const deleteOrganization = async (req, res) => {
  const { org_id } = req.params;

  const transaction = await sequelize.transaction();

  try {

    const [patientResults] = await sequelize.query(
      `
      DELETE FROM patient_test_results
      WHERE history_id IN (
        SELECT history_id
        FROM test_histories
        WHERE org_id = :org_id
      )
      RETURNING result_id
      `,
      {
        replacements: { org_id },
        transaction,
      }
    );

    const [histories] = await sequelize.query(
      `
      DELETE FROM test_histories
      WHERE org_id = :org_id
      RETURNING history_id
      `,
      {
        replacements: { org_id },
        transaction,
      }
    );

    const [patients] = await sequelize.query(
      `
      DELETE FROM patients
      WHERE org_id = :org_id
      RETURNING patient_id
      `,
      {
        replacements: { org_id },
        transaction,
      }
    );

    const [devices] = await sequelize.query(
      `
      DELETE FROM devices
      WHERE org_id = :org_id
      RETURNING device_id
      `,
      {
        replacements: { org_id },
        transaction,
      }
    );

    const [tokens] = await sequelize.query(
      `
      DELETE FROM tokens
      WHERE org_id = :org_id
      RETURNING id
      `,
      {
        replacements: { org_id },
        transaction,
      }
    );

    const [users] = await sequelize.query(
      `
      DELETE FROM users
      WHERE org_id = :org_id
      RETURNING user_id
      `,
      {
        replacements: { org_id },
        transaction,
      }
    );

    const [organization] = await sequelize.query(
      `
      DELETE FROM organizations
      WHERE org_id = :org_id
      RETURNING org_id, org_name
      `,
      {
        replacements: { org_id },
        transaction,
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Organization deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to delete organization",
      error: error.message,
    });
  }
};