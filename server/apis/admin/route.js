import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfAdmin } from '../../middleware/auth.js';
import { addDevice, addTechnician, assignDevice, getAllDevices, getAllTechnicians, getDeviceByDeviceId, getDevicesNotAssignToTechnician, getTechnicianDetail, removeTechnician, getAllPatientsAdmin, getPatientByIdAdmin, addPatientAdmin, updatePatientAdmin, getPatientTestsAdmin, getSessionReportAdmin, getAnalyticsOverviewAdmin, getAnalyticsChartsAdmin, getTestTypeSessionsAdmin, getTestTypesAdmin, registerTestSessionAdmin, completeTestSessionAdmin, generateCsvReportAdmin, generatePdfReportAdmin, getTatAnalyticsAdmin } from './controller.js';

// // list of users
router.get("/devices/:rows/:page?", checkAuthorization, checkIfAdmin(), getAllDevices); //...done
router.get("/device/:device_id", checkAuthorization, checkIfAdmin(), getDeviceByDeviceId); //...done
router.get("/devices-not-assign/:rows/:page?", checkAuthorization, checkIfAdmin(), getDevicesNotAssignToTechnician); //...DONE

router.post("/add/technician", checkAuthorization, checkIfAdmin(), addTechnician); //...DONE
router.get("/technicians/:rows/:page", checkAuthorization, checkIfAdmin(), getAllTechnicians); //...DONE
router.put("/device/:device_id/assign", checkAuthorization, checkIfAdmin(), assignDevice);
router.post("/add/device", checkAuthorization, checkIfAdmin(), addDevice);
router.get("/technician/:technician_id", checkAuthorization, checkIfAdmin(), getTechnicianDetail);
router.delete("/technician/:technician_id", checkAuthorization, checkIfAdmin(), removeTechnician);

// Patient management
router.get("/patients/:rows/:page", checkAuthorization, checkIfAdmin(), getAllPatientsAdmin);
router.get("/patient/:patient_id", checkAuthorization, checkIfAdmin(), getPatientByIdAdmin);
router.post("/add/patient", checkAuthorization, checkIfAdmin(), addPatientAdmin);
router.put("/patient/:patient_id", checkAuthorization, checkIfAdmin(), updatePatientAdmin);
router.get("/patient/:patient_id/tests/:rows/:page", checkAuthorization, checkIfAdmin(), getPatientTestsAdmin);
router.get("/session/:history_id/report", checkAuthorization, checkIfAdmin(), getSessionReportAdmin);

// Analytics
router.get("/analytics/overview", checkAuthorization, checkIfAdmin(), getAnalyticsOverviewAdmin);
router.get("/analytics/charts", checkAuthorization, checkIfAdmin(), getAnalyticsChartsAdmin);
router.get("/analytics/test-type-sessions", checkAuthorization, checkIfAdmin(), getTestTypeSessionsAdmin);
router.get("/analytics/tat", checkAuthorization, checkIfAdmin(), getTatAnalyticsAdmin);

// Admin test sessions (admin performs tests like a technician)
router.get("/test-types", checkAuthorization, checkIfAdmin(), getTestTypesAdmin);
router.post("/patient/register-test", checkAuthorization, checkIfAdmin(), registerTestSessionAdmin);
router.put("/session/:history_id/complete", checkAuthorization, checkIfAdmin(), completeTestSessionAdmin);

// Reports (CSV + PDF)
router.get("/reports/csv", checkAuthorization, checkIfAdmin(), generateCsvReportAdmin);
router.get("/reports/pdf", checkAuthorization, checkIfAdmin(), generatePdfReportAdmin);

// // add user
// router.post("/user/add", checkAuthorization, checkIfAdmin(), addUser);

// //show user profile
// router.get("/user/profile/:id", checkAuthorization, checkIfAdmin(), userProfile);

// // update user profile
// router.post("/user/update/:id", checkAuthorization, checkIfAdmin(), updateUserProfile);

export default router;