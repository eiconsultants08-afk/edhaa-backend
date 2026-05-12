import express from "express";
const router = express.Router();

import { checkAuthorization, checkIfSuperAdmin } from "../../middleware/auth.js";

import {
  getSuperAdminDashboard,

  getAllOrganizations,
  getOrganizationById,
  addOrganization,
  updateOrganization,

  getAllTechniciansSuperAdmin,
  getTechnicianByIdSuperAdmin,
  addTechnicianSuperAdmin,
  updateTechnicianSuperAdmin,

  getAllTestsSuperAdmin,
  getTestByIdSuperAdmin,
  updateTestSuperAdmin,
  getSuperAdminAnalyticsData,
} from "./controller.js";

// Dashboard
router.get("/dashboard", checkAuthorization, checkIfSuperAdmin(), getSuperAdminDashboard);

// Organizations
router.get("/organizations/:rows/:page", checkAuthorization, checkIfSuperAdmin(), getAllOrganizations);

router.get("/organization/:org_id", checkAuthorization, checkIfSuperAdmin(), getOrganizationById);

router.post("/add/organization", checkAuthorization, checkIfSuperAdmin(), addOrganization);

router.put("/organization/:org_id", checkAuthorization, checkIfSuperAdmin(), updateOrganization);

// Technicians
router.get("/technicians/:rows/:page", checkAuthorization, checkIfSuperAdmin(), getAllTechniciansSuperAdmin);

router.get("/technician/:technician_id", checkAuthorization, checkIfSuperAdmin(), getTechnicianByIdSuperAdmin);

router.post("/add/technician", checkAuthorization, checkIfSuperAdmin(), addTechnicianSuperAdmin);

router.put("/technician/:technician_id", checkAuthorization, checkIfSuperAdmin(), updateTechnicianSuperAdmin);

// Tests
router.get("/tests/:rows/:page", checkAuthorization, checkIfSuperAdmin(), getAllTestsSuperAdmin);

router.get("/test/:test_type_id", checkAuthorization, checkIfSuperAdmin(), getTestByIdSuperAdmin);

router.put("/test/:test_type_id", checkAuthorization, checkIfSuperAdmin(), updateTestSuperAdmin);

router.get("/analytics",checkAuthorization,checkIfSuperAdmin(),getSuperAdminAnalyticsData);

export default router;