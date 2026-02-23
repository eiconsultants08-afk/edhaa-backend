import express from 'express';
const router = express.Router();
import { refresh, login, logout } from './controller.js';

import { checkAuthorization } from '../../middleware/auth.js';

router.post("/login", login);

router.post("/refresh", refresh);

router.get("/logout", checkAuthorization, logout);

export default router;