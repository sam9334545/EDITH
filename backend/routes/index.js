import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import appRoutes from './appRoutes.js';
import eventRoutes from './eventRoutes.js';
import securityRoutes from './securityRoutes.js';
import historyRoutes from './historyRoutes.js';
import statsRoutes from './statsRoutes.js';
import demoRoutes from './demoRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/apps', appRoutes);
router.use('/events', eventRoutes);
router.use('/security', securityRoutes);
router.use('/history', historyRoutes);
router.use('/stats', statsRoutes);
router.use('/demo', demoRoutes);

export default router;
