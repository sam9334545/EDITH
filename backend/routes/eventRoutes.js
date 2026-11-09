import { Router } from 'express';
import { getEvents, simulateEvents } from '../controllers/eventController.js';

const router = Router();

router.get('/', getEvents);
router.post('/simulate', simulateEvents);

export default router;
