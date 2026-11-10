import { Router } from 'express';
import { ok, fail, RESOURCE_TYPES } from '../../shared/contracts.js';
import { store } from '../store/index.js';
import { getBaseline, buildBaseline } from '../services/behaviouralDna.js';

const router = Router();

/**
 * GET /api/dna/baselines
 * Query: ?appId (optional)
 * Returns baseline profiles.
 */
router.get('/baselines', (req, res) => {
  const { appId } = req.query || {};
  const baselines = store.getBaselines(appId || null);
  return res.json(ok(baselines));
});

/**
 * GET /api/dna/baselines/:appId
 * Returns all baselines for a specific application.
 */
router.get('/baselines/:appId', (req, res) => {
  const { appId } = req.params;
  const app = store.findAppById(appId);
  if (!app) {
    return res.status(404).json(fail('APP_NOT_FOUND', `Application ${appId} not found`));
  }

  const baselines = RESOURCE_TYPES.map((resource) => getBaseline(appId, resource, store));
  return res.json(ok({
    appId,
    appName: app.name,
    baselines,
  }));
});

/**
 * GET /api/dna/profile/:appId
 * Comprehensive Behavioural DNA profile with usage stats and patterns.
 */
router.get('/profile/:appId', (req, res) => {
  const { appId } = req.params;
  const app = store.findAppById(appId);
  if (!app) {
    return res.status(404).json(fail('APP_NOT_FOUND', `Application ${appId} not found`));
  }

  const appEvents = (store.events || []).filter((e) => e.appId === appId);
  const baselines = RESOURCE_TYPES.map((resource) => getBaseline(appId, resource, store));

  const totalAccesses = baselines.reduce((sum, b) => sum + (b.accessCount || 0), 0);
  const activeResources = baselines.filter((b) => (b.accessCount || 0) > 0).map((b) => b.resource);

  return res.json(ok({
    appId,
    appName: app.name,
    status: app.status,
    trustScore: app.trustScore,
    totalAccesses,
    activeResources,
    baselines,
    recentEventsCount: appEvents.length,
    updatedAt: store.clock.now(),
  }));
});

/**
 * POST /api/dna/baselines/:appId/recalculate
 * Recalculates baselines from full recorded event history.
 */
router.post('/baselines/:appId/recalculate', (req, res) => {
  const { appId } = req.params;
  const app = store.findAppById(appId);
  if (!app) {
    return res.status(404).json(fail('APP_NOT_FOUND', `Application ${appId} not found`));
  }

  const appEvents = (store.events || []).filter((e) => e.appId === appId);
  const updatedBaselines = RESOURCE_TYPES.map((resource) => {
    const baseline = buildBaseline(appId, resource, appEvents, app);
    store.updateBaseline(appId, resource, baseline);
    return baseline;
  });

  return res.json(ok({
    appId,
    message: 'Behavioural DNA baselines recalculated successfully',
    baselines: updatedBaselines,
  }));
});

export default router;
