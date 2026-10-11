import express from 'express';
import jwtTokenController from '../../../features/security/jwt-token/jwt-token.controller.js';

const router = express.Router();

router.post(
  '/api/logout',
  jwtTokenController.expressLogout
);

export default router;
