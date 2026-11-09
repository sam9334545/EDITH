import { Router } from 'express';
import { getHistory, getHistorySummary } from '../controllers/historyController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// Summary stats endpoint
router.get('/summary', asyncHandler(getHistorySummary));

// Main history endpoint: GET /api/history
router.get('/', asyncHandler(getHistory));

export default router;
