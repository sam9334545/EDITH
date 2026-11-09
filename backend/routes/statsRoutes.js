import { Router } from 'express';
import { getStats } from '../controllers/statsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(getStats));

export default router;
