import express from 'express';
import jwtTokenController from '../../../features/security/jwt-token/jwt-token.controller.js';
import accountManagerController from '../../../features/owner/settings/account-manager/account-manager.controller.js';

const router = express.Router();

router.post(
  '/api/user/change-password',
  jwtTokenController.expressAuthenticateToken,
  accountManagerController.changePasswordSelf
);

export default router;
