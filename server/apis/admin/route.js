import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfAdmin } from '../../middleware/auth.js';
import { getAllDevices } from './controller.js';
// import {
//     getUsers,
//     addUser,
//     userProfile,
//     updateUserProfile,
// } from './controller.js'

// // list of users
router.get("/devices/:rows/:page?", checkAuthorization, checkIfAdmin(), getAllDevices);

// // add user
// router.post("/user/add", checkAuthorization, checkIfAdmin(), addUser);

// //show user profile
// router.get("/user/profile/:id", checkAuthorization, checkIfAdmin(), userProfile);

// // update user profile
// router.post("/user/update/:id", checkAuthorization, checkIfAdmin(), updateUserProfile);

export default router;