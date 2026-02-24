import express from 'express';
const router = express.Router();
import { checkAuthorization, checkIfUser } from '../../middleware/auth.js';
import { userProfile } from './controller.js';

router.get("/profile", checkAuthorization, checkIfUser(), userProfile);

export default router;

