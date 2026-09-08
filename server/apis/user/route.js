import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfUser } from '../../middleware/auth.js';
import { changePassword, updateUserProfile, userProfile } from './controller.js';

router.get("/profile", checkAuthorization, checkIfUser(), userProfile);

router.put("/profile",checkAuthorization,checkIfUser(),updateUserProfile);

router.put("/change-password",checkAuthorization,checkIfUser(),changePassword);

export default router;

