import express from 'express';
import { checkDbHealth } from '../../../database/pool.js';

const router = express.Router();

router.get('/health', checkDbHealth);

export default router;
