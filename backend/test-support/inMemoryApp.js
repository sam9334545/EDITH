import express from 'express';
import cors from 'cors';
import { store } from '../store/index.js';
import * as permissionService from '../services/permissionService.js';
import raspMiddleware from '../middleware/raspMiddleware.js';
import { APPLICATION_STATUS, ok, fail } from '../../shared/contracts.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(raspMiddleware);

app.get('/api/apps', (req, res) => {
  const status = req.query.status || null;
  if (status && !Object.values(APPLICATION_STATUS).includes(status)) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid status filter'));
  }
  return res.json(ok(permissionService.getAllApps(status), 'Applications retrieved successfully'));
});

app.get('/api/apps/:id', (req, res) => {
  const appData = permissionService.getAppById(req.params.id);
  if (!appData) return res.status(404).json(fail('APP_NOT_FOUND', 'Application not found'));
  return res.json(ok(appData, 'Application retrieved successfully'));
});

app.patch('/api/apps/:id/permissions', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'Request body cannot be empty'));
  }
  const extraKeys = Object.keys(body).filter((key) => !['resource', 'enabled'].includes(key));
  if (extraKeys.length) {
    return res.status(400).json(fail('VALIDATION_ERROR', `Unsupported fields in request body: ${extraKeys.join(', ')}`));
  }
  if (body.resource === undefined) return res.status(400).json(fail('VALIDATION_ERROR', 'resource is required'));
  if (body.enabled === undefined) return res.status(400).json(fail('VALIDATION_ERROR', 'enabled is required'));
  if (typeof body.enabled !== 'boolean') return res.status(400).json(fail('VALIDATION_ERROR', 'enabled must be boolean'));
  try {
    const updated = permissionService.updatePermission(
      req.params.id,
      body.resource,
      body.enabled,
    );
    return res.json(ok(updated, 'Permission updated successfully'));
  } catch (error) {
    const code = error.code || 'INTERNAL_ERROR';
    const status = code === 'APP_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(fail(code, error.message));
  }
});

app.patch('/api/apps/:id/status', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) {
    return res.status(400).json(fail('VALIDATION_ERROR', 'Request body cannot be empty'));
  }
  const extraKeys = Object.keys(body).filter((key) => key !== 'status');
  if (extraKeys.length) {
    return res.status(400).json(fail('VALIDATION_ERROR', `Unsupported fields in request body: ${extraKeys.join(', ')}`));
  }
  try {
    const updated = permissionService.updateAppStatus(req.params.id, body.status);
    const message = body.status === APPLICATION_STATUS.SUSPENDED
      ? 'Application suspended successfully'
      : 'Application reactivated successfully';
    return res.json(ok(updated, message));
  } catch (error) {
    const code = error.code || 'INTERNAL_ERROR';
    const status = code === 'APP_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(fail(code, error.message));
  }
});

app.post('/api/demo/reset', (req, res) => {
  store.resetToSeed();
  return res.json(ok({ reset: true }, 'Demo state reset to seed'));
});

export default app;
