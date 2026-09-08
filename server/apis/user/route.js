import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfUser } from '../../middleware/auth.js';
import { updateUserProfile, userProfile } from './controller.js';

router.get("/profile", checkAuthorization, checkIfUser(), userProfile);

router.put("/profile",checkAuthorization,checkIfUser(),updateUserProfile);

export default router;

