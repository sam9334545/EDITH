import { Router } from 'express';
import { getEvents, simulateEvents } from '../controllers/eventController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(getEvents));
router.post('/simulate', asyncHandler(simulateEvents));

export default router;
