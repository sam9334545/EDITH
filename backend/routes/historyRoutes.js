import { Router } from 'express';
import { getHistory, getHistorySummary } from '../controllers/historyController.js';

const router = Router();

// Summary stats endpoint
router.get('/summary', getHistorySummary);

// Main history endpoint: GET /api/history
router.get('/', getHistory);

export default router;
