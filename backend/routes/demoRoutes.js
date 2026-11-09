import { Router } from 'express';
import { resetDemo } from '../controllers/demoController.js';

const router = Router();

router.post('/reset', resetDemo);

export default router;
