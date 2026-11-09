import { Router } from 'express';
import appRoutes from './appRoutes.js';
import demoRoutes from './demoRoutes.js';
import eventRoutes from './eventRoutes.js';
import healthRoutes from './healthRoutes.js';
import historyRoutes from './historyRoutes.js';
import securityRoutes from './securityRoutes.js';
import statsRoutes from './statsRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/stats', statsRoutes);
router.use('/demo', demoRoutes);
router.use('/apps', appRoutes);
router.use('/events', eventRoutes);
router.use('/history', historyRoutes);
router.use('/security', securityRoutes);

export default router;
