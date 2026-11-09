// Express Application Setup for E.D.I.T.H.
import express from 'express';
import cors from 'cors';
import { ok, fail } from '../shared/contracts.js';
import { store } from './store/index.js';
import appRoutes from './routes/appRoutes.js';
import { processAccessRequest } from './services/accessPipeline.js';

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Health endpoint
app.get('/api/health', (req, res) => {
  return res.status(200).json(ok({
    status: 'ok',
    uptime: Math.round(process.uptime() * 10) / 10,
    simulated: true,
  }, 'Service healthy'));
});

// M2 Apps & Permissions routes
app.use('/api/apps', appRoutes);

// History endpoint (M3 stub/integration)
app.get('/api/history', (req, res) => {
  const { appId, type, limit } = req.query;
  const history = store.getHistory({
    appId,
    type,
    limit: limit ? parseInt(limit, 10) : 100,
  });
  return res.status(200).json(ok(history, 'History retrieved successfully'));
});

// Events endpoint (M3 stub/integration)
app.get('/api/events', (req, res) => {
  const { appId, resource, status, suspicious, limit } = req.query;
  const events = store.getEvents({
    appId,
    resource,
    status,
    suspicious: suspicious !== undefined ? suspicious === 'true' : undefined,
    limit: limit ? parseInt(limit, 10) : 50,
  });
  return res.status(200).json(ok(events, 'Events retrieved successfully'));
});

// Simulation endpoint for access requests
app.post('/api/events/simulate', (req, res) => {
  try {
    const { appId, resource, reason, count = 1, startTime } = req.body || {};
    const totalCount = count && Number.isInteger(count) ? count : 1;
    const baseTime = startTime ? new Date(startTime).getTime() : Date.now();

    const results = [];
    let allowedCount = 0;
    let deniedCount = 0;
    let finalApp = null;

    for (let i = 0; i < totalCount; i++) {
      const simTime = new Date(baseTime + i * 2000).toISOString();
      const resData = processAccessRequest({
        appId,
        resource,
        reason,
        timestamp: simTime,
      });
      results.push(resData.event);
      finalApp = resData.app;
      if (resData.allowed) allowedCount++;
      else deniedCount++;
    }

    return res.status(200).json(ok({
      events: results,
      summary: { total: totalCount, allowed: allowedCount, denied: deniedCount },
      alertsCreated: [],
      app: finalApp,
      trustScore: {
        appId,
        score: finalApp ? finalApp.trustScore : 0,
        level: finalApp ? finalApp.trustLevel : 'critical',
        explanation: ['Simulated run'],
      },
      recommendations: [],
    }, 'Simulation completed'));
  } catch (err) {
    if (err.code === 'APP_NOT_FOUND') {
      return res.status(404).json(fail('APP_NOT_FOUND', err.message));
    }
    if (err.code === 'VALIDATION_ERROR') {
      return res.status(400).json(fail('VALIDATION_ERROR', err.message));
    }
    return res.status(500).json(fail('INTERNAL_ERROR', err.message));
  }
});

// Demo reset endpoint
app.post('/api/demo/reset', (req, res) => {
  store.resetToSeed();
  return res.status(200).json(ok({ reset: true }, 'Demo state reset to seed'));
});

// 404 Handler
app.use((req, res) => {
  return res.status(404).json(fail('NOT_FOUND', `Route ${req.method} ${req.url} not found`));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const code = err.code || 'INTERNAL_ERROR';
  const status = code === 'VALIDATION_ERROR' ? 400 : 500;
  return res.status(status).json(fail(code, err.message || 'Internal server error'));
});

export default app;
