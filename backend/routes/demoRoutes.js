import { Router } from 'express';
import { resetDemo } from '../controllers/demoController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/reset', asyncHandler(resetDemo));

export default router;
