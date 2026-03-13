import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfAdmin } from '../../middleware/auth.js';
import { addTechnician, getAllDevices, getAllTechnicians, getDeviceByDeviceId, getDevicesNotAssignToTechnician } from './controller.js';

// // list of users
router.get("/devices/:rows/:page?", checkAuthorization, checkIfAdmin(), getAllDevices); //...done
router.get("/device/:device_id", checkAuthorization, checkIfAdmin(), getDeviceByDeviceId); //...done
router.get("/devices-not-assign/:rows/:page?", checkAuthorization, checkIfAdmin(), getDevicesNotAssignToTechnician); //...DONE

router.post("/add/technician",checkAuthorization, checkIfAdmin(), addTechnician); //...DONE
router.get("/technicians/:rows/:page", checkAuthorization, checkIfAdmin(), getAllTechnicians); //...DONE

// // add user
// router.post("/user/add", checkAuthorization, checkIfAdmin(), addUser);

// //show user profile
// router.get("/user/profile/:id", checkAuthorization, checkIfAdmin(), userProfile);

// // update user profile
// router.post("/user/update/:id", checkAuthorization, checkIfAdmin(), updateUserProfile);

export default router;