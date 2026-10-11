import express from 'express';
import loginController from '../../../features/login/login.controller.js';
import jwtTokenController from '../../../features/security/jwt-token/jwt-token.controller.js';

const router = express.Router();

const createRateLimiter = ({ windowMs, max }) => {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
    } else if (++current.count > max) {
      return res.status(429).json({
        success: false,
        error: 'Terlalu banyak request. Silakan coba lagi nanti.'
      });
    }

    res.set('X-RateLimit-Limit', String(max));
    return next();
  };
};

router.post(
  '/api/login',
  createRateLimiter({
    windowMs: 60_000,
    max: 10
  }),
  loginController.handleExpressLogin
);

router.post(
  '/api/token/refresh',
  createRateLimiter({
    windowMs: 60_000,
    max: 20
  }),
  jwtTokenController.expressRotateSessionToken
);

export default router;
