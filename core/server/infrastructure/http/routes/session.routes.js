import express from 'express';
import jwtTokenController from '../../../features/security/jwt-token/jwt-token.controller.js';

const router = express.Router();

router.get(
  '/api/session/heartbeat',
  jwtTokenController.expressAuthenticateToken,
  (req, res) => {
    return res.status(200).json({
      success: true,
      code: 'SESSION_ACTIVE'
    });
  }
);

export default router;
