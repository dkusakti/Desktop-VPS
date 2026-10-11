import express from 'express';
import jwtTokenController from '../../../features/security/jwt-token/jwt-token.controller.js';
import MandorFrontend from '../../ipc/mandor-frontend.js';

const router = express.Router();

router.post(
  '/api/dynamic/crud',
  jwtTokenController.expressAuthenticateToken,
  MandorFrontend.handleExpressDynamicCRUD
);

export default router;
