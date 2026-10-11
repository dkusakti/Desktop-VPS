import express from 'express';
import { VerifyDeviceController } from '../../../features/owner/settings/verify-device/verify-device.controller.js';
import jwtTokenController from '../../../features/security/jwt-token/jwt-token.controller.js';
import vpsRoleGuard from '../middleware/capability-guard.js';

const router = express.Router();

router.post(
  '/api/settings/verify-device',
  jwtTokenController.expressAuthenticateToken,
  vpsRoleGuard('APPROVE_DEVICE'),
  VerifyDeviceController.handleExpressVerify
);

export default router;
