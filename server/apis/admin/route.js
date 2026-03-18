import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfAdmin } from '../../middleware/auth.js';
import { addDevice, addTechnician, assignDevice, getAllDevices, getAllTechnicians, getDeviceByDeviceId, getDevicesNotAssignToTechnician, getTechnicianDetail, removeTechnician } from './controller.js';

// // list of users
router.get("/devices/:rows/:page?", checkAuthorization, checkIfAdmin(), getAllDevices); //...done
router.get("/device/:device_id", checkAuthorization, checkIfAdmin(), getDeviceByDeviceId); //...done
router.get("/devices-not-assign/:rows/:page?", checkAuthorization, checkIfAdmin(), getDevicesNotAssignToTechnician); //...DONE

router.post("/add/technician",checkAuthorization, checkIfAdmin(), addTechnician); //...DONE
router.get("/technicians/:rows/:page", checkAuthorization, checkIfAdmin(), getAllTechnicians); //...DONE
router.put("/device/:device_id/assign", checkAuthorization, checkIfAdmin(), assignDevice);
router.post("/add/device", checkAuthorization, checkIfAdmin(), addDevice);
router.get("/technician/:technician_id", checkAuthorization, checkIfAdmin(), getTechnicianDetail);
router.delete("/technician/:technician_id", checkAuthorization, checkIfAdmin(), removeTechnician);

// // add user
// router.post("/user/add", checkAuthorization, checkIfAdmin(), addUser);

// //show user profile
// router.get("/user/profile/:id", checkAuthorization, checkIfAdmin(), userProfile);

// // update user profile
// router.post("/user/update/:id", checkAuthorization, checkIfAdmin(), updateUserProfile);

export default router;