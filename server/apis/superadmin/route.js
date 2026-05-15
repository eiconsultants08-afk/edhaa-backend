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
  getAllPlansSuperAdmin,
  getPlanByIdSuperAdmin,
  addPlanSuperAdmin,
  updatePlanSuperAdmin,
  getAllAdminsSuperAdmin,
  getAdminByIdSuperAdmin,
  addAdminSuperAdmin,
  updateAdminSuperAdmin,
  getAllDevicesSuperAdmin,
  getDeviceByIdSuperAdmin,
  addDeviceSuperAdmin,
  updateDeviceSuperAdmin,
  addTestSuperAdmin,
} from "./controller.js";

// Dashboard
router.get("/dashboard", checkAuthorization, checkIfSuperAdmin(), getSuperAdminDashboard);

// Organizations
router.get("/organizations/:rows/:page", checkAuthorization, checkIfSuperAdmin(), getAllOrganizations);

router.get("/organization/:org_id", checkAuthorization, checkIfSuperAdmin(), getOrganizationById);

router.post("/add/organization", checkAuthorization, checkIfSuperAdmin(), addOrganization);

router.put("/organization/:org_id", checkAuthorization, checkIfSuperAdmin(), updateOrganization);

// Admins
router.get("/admins/:rows/:page", checkAuthorization, checkIfSuperAdmin(), getAllAdminsSuperAdmin);

router.get("/admin/:admin_id", checkAuthorization, checkIfSuperAdmin(), getAdminByIdSuperAdmin);

router.post("/add/admin", checkAuthorization, checkIfSuperAdmin(), addAdminSuperAdmin);

router.put("/admin/:admin_id", checkAuthorization, checkIfSuperAdmin(), updateAdminSuperAdmin);

// Technicians
router.get("/technicians/:rows/:page", checkAuthorization, checkIfSuperAdmin(), getAllTechniciansSuperAdmin);

router.get("/technician/:technician_id", checkAuthorization, checkIfSuperAdmin(), getTechnicianByIdSuperAdmin);

router.post("/add/technician", checkAuthorization, checkIfSuperAdmin(), addTechnicianSuperAdmin);

router.put("/technician/:technician_id", checkAuthorization, checkIfSuperAdmin(), updateTechnicianSuperAdmin);

// Tests
router.get("/tests/:rows/:page", checkAuthorization, checkIfSuperAdmin(), getAllTestsSuperAdmin);

router.get("/test/:test_type_id", checkAuthorization, checkIfSuperAdmin(), getTestByIdSuperAdmin);

router.post("/add/test", checkAuthorization, checkIfSuperAdmin(), addTestSuperAdmin);

router.put("/test/:test_type_id", checkAuthorization, checkIfSuperAdmin(), updateTestSuperAdmin);

// Devices
router.get("/devices/:rows/:page", checkAuthorization, checkIfSuperAdmin(), getAllDevicesSuperAdmin);

router.get("/device/:device_id", checkAuthorization, checkIfSuperAdmin(), getDeviceByIdSuperAdmin);

router.post("/add/device", checkAuthorization, checkIfSuperAdmin(), addDeviceSuperAdmin);

router.put("/device/:device_id", checkAuthorization, checkIfSuperAdmin(), updateDeviceSuperAdmin);

// Plans
router.get("/plans/:rows/:page", checkAuthorization, checkIfSuperAdmin(), getAllPlansSuperAdmin);

router.get("/plan/:plan_id", checkAuthorization, checkIfSuperAdmin(), getPlanByIdSuperAdmin);

router.post("/add/plan", checkAuthorization, checkIfSuperAdmin(), addPlanSuperAdmin);

router.put("/plan/:plan_id", checkAuthorization, checkIfSuperAdmin(), updatePlanSuperAdmin);

router.get("/analytics",checkAuthorization,checkIfSuperAdmin(),getSuperAdminAnalyticsData);

export default router;