import store from '../store/index.js';
import permissionService from '../services/permissionService.js';
import {
  ok,
  fail,
  validatePermissionPatch,
  validateStatusPatch,
  trustLevelFor,
} from '../../shared/contracts.js';

export const getApps = (req, res) => {
  const { status } = req.query;
  let apps = store.getState().apps;
  if (status) {
    apps = apps.filter((a) => a.status === status);
  }
  return res.status(200).json(ok(apps, 'Applications retrieved successfully'));
};

export const getAppById = (req, res) => {
  const { id } = req.params;
  const app = store.findAppById(id);
  if (!app) {
    return res.status(404).json(fail('APP_NOT_FOUND', `Application ${id} not found`));
  }
  return res.status(200).json(
    ok(
      {
        ...app,
        trustLevel: trustLevelFor(app.trustScore),
      },
      'Application retrieved successfully'
    )
  );
};

export const updateAppPermission = (req, res) => {
  const { id } = req.params;
  const error = validatePermissionPatch(req.body);
  if (error) {
    return res.status(400).json(fail('VALIDATION_ERROR', error));
  }

  const app = store.findAppById(id);
  if (!app) {
    return res.status(404).json(fail('APP_NOT_FOUND', `Application ${id} not found`));
  }

  const updated = permissionService.updatePermission(id, req.body.resource, req.body.enabled);
  return res.status(200).json(
    ok(
      {
        ...updated,
        trustLevel: trustLevelFor(updated.trustScore),
      },
      'Permission updated successfully'
    )
  );
};

export const updateAppStatus = (req, res) => {
  const { id } = req.params;
  const error = validateStatusPatch(req.body);
  if (error) {
    return res.status(400).json(fail('VALIDATION_ERROR', error));
  }

  const app = store.findAppById(id);
  if (!app) {
    return res.status(404).json(fail('APP_NOT_FOUND', `Application ${id} not found`));
  }

  const updated = permissionService.updateStatus(id, req.body.status);
  return res.status(200).json(
    ok(
      {
        ...updated,
        trustLevel: trustLevelFor(updated.trustScore),
      },
      'Application status updated successfully'
    )
  );
};

export default {
  getApps,
  getAppById,
  updateAppPermission,
  updateAppStatus,
};
