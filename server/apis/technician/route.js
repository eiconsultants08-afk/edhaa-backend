import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfTechnician } from '../../middleware/auth.js';
import {addPatient, addPatientTestResults, getAllPatients, getDeviceByDeviceId, getPatientById} from './controller.js';

// // add user
router.get("/patients/:rows/:page?", checkAuthorization, checkIfTechnician, getAllPatients); //...done
router.get("/patient/:patient_id",checkAuthorization, checkIfTechnician,getPatientById); //...done
router.post("/add/patient", checkAuthorization, checkIfTechnician, addPatient); //....done
router.post("/patient/add-test", checkAuthorization, checkIfTechnician,addPatientTestResults); //...done
router.get("/device/search/:device_id", checkAuthorization, checkIfTechnician, getDeviceByDeviceId); //...done

// //show user profile
// router.get("/user/profile/:id", checkAuthorization, checkIfAdmin(), userProfile);

// // update user profile
// router.post("/user/update/:id", checkAuthorization, checkIfAdmin(), updateUserProfile);

export default router;