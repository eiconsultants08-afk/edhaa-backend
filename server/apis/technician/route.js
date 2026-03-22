import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfTechnician } from '../../middleware/auth.js';
import {
  addPatient,
  registerTestSession,
  completeTestSession,
  getAllPatients,
  getDeviceByDeviceId,
  getMyDevices,
  getPatientById,
  getTestTypes,
  getPatientTests,
  getTestResult,
  getTestResultReport,
  getSessionReport,
  updatePatientRecord,
  updateTestResult,
  updateSession,
  addSessionResults,
} from './controller.js';

router.get("/patients/:rows/:page?", checkAuthorization, checkIfTechnician, getAllPatients);
router.get("/patient/:patient_id", checkAuthorization, checkIfTechnician, getPatientById);
router.post("/add/patient", checkAuthorization, checkIfTechnician, addPatient);
router.post("/patient/add-test", checkAuthorization, checkIfTechnician, registerTestSession);
router.get("/devices", checkAuthorization, checkIfTechnician, getMyDevices);
router.get("/device/search/:device_id", checkAuthorization, checkIfTechnician, getDeviceByDeviceId);

// New endpoints
router.get("/test-types", checkAuthorization, checkIfTechnician, getTestTypes);
router.get("/patient/:id/tests/:rows/:page", checkAuthorization, checkIfTechnician, getPatientTests);
router.get("/test/:result_id", checkAuthorization, checkIfTechnician, getTestResult);
router.get("/test/:result_id/report", checkAuthorization, checkIfTechnician, getTestResultReport);
router.get("/session/:history_id/report", checkAuthorization, checkIfTechnician, getSessionReport);
router.put("/session/:history_id", checkAuthorization, checkIfTechnician, updateSession);
router.put("/session/:history_id/complete", checkAuthorization, checkIfTechnician, completeTestSession);
router.post("/session/:history_id/results", checkAuthorization, checkIfTechnician, addSessionResults);
// Technicians cannot edit patient records — blocked at controller level
// router.put("/patient/:patient_id", ...)
router.put("/test/:result_id", checkAuthorization, checkIfTechnician, updateTestResult);

export default router;