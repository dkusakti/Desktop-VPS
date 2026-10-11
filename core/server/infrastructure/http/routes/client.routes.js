import express from 'express';
import loginController from '../../../features/login/login.controller.js';
import jwtTokenController from '../../../features/security/jwt-token/jwt-token.controller.js';
import logoutController from '../../../features/logout/logout.controller.js';

const router = express.Router();

router.post(
  '/api/client/login',
  loginController.handleExpressClientLogin
);

router.post(
  '/api/client/token/refresh',
  jwtTokenController.expressRotateClientSessionToken
);

router.post(
  '/api/client/logout',
  jwtTokenController.expressAuthenticateToken,
  logoutController.handleExpressLogout
);

export default router;
