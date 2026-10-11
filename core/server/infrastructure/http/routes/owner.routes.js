import express from 'express';
import liveMonitoringController from '../../../features/owner/live-monitoring/live-monitoring.controller.js';
import resetHardwareController from '../../../features/owner/reset-hardware/reset-hardware.controller.js';
import accountManagerController from '../../../features/owner/settings/account-manager/account-manager.controller.js';
import jwtTokenController from '../../../features/security/jwt-token/jwt-token.controller.js';
import vpsRoleGuard from '../middleware/capability-guard.js';

const router = express.Router();

router.get(
  '/api/owner/monitoring',
  jwtTokenController.expressAuthenticateToken,
  vpsRoleGuard('CHECK_HEARTBEAT_AND_DEVICES'),
  liveMonitoringController.handleExpressTableUpdate
);

router.post(
  '/api/owner/reset-hardware',
  jwtTokenController.expressAuthenticateToken,
  vpsRoleGuard('TRUNCATE_HARDWARE_DATA'),
  resetHardwareController.handleExpressEmergencyReset
);

router.post(
  '/api/owner/register-user',
  jwtTokenController.expressAuthenticateToken,
  vpsRoleGuard('REGISTER_USER'),
  accountManagerController.registerNewUser
);

export default router;
