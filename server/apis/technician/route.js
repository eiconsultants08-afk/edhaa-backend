import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfTechnician } from '../../middleware/auth.js';
import {addPatient, addPatientTestResults, getAllPatients, getDeviceByDeviceId, getPatientById} from './controller.js';

// // add user
router.post("/patients/:rows/:page?", checkAuthorization, checkIfTechnician, getAllPatients);
router.get("/patient/:patient_id",checkAuthorization, checkIfTechnician,getPatientById);
router.post("/add/patient", checkAuthorization, checkIfTechnician, addPatient);
router.post("/patient/add-test", checkAuthorization, checkIfTechnician,addPatientTestResults);
router.get("/device/:device_id", checkAuthorization, checkIfTechnician, getDeviceByDeviceId);

// //show user profile
// router.get("/user/profile/:id", checkAuthorization, checkIfAdmin(), userProfile);

// // update user profile
// router.post("/user/update/:id", checkAuthorization, checkIfAdmin(), updateUserProfile);

export default router;