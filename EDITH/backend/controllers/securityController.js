import {
  ALERT_SEVERITY,
  fail,
  ok,
} from '../../shared/contracts.js';
import { acknowledgeAlert, listAlerts } from '../services/securityService.js';

const severities = new Set(Object.values(ALERT_SEVERITY));
const alertIdPattern = /^alt_\d{4,}$/;

function validationError(message) {
  return { status: 400, body: fail('VALIDATION_ERROR', message) };
}

function parseFilters(query = {}) {
  const filters = {};

  if (query.appId !== undefined) {
    if (typeof query.appId !== 'string' || query.appId.trim() === '') {
      return { error: 'appId must be a non-empty string' };
    }
    filters.appId = query.appId;
  }

  if (query.severity !== undefined) {
    if (typeof query.severity !== 'string' || !severities.has(query.severity)) {
      return { error: `severity must be one of ${[...severities].join(', ')}` };
    }
    filters.severity = query.severity;
  }

  if (query.acknowledged !== undefined) {
    if (query.acknowledged !== 'true' && query.acknowledged !== 'false') {
      return { error: 'acknowledged must be true or false' };
    }
    filters.acknowledged = query.acknowledged === 'true';
  }

  if (query.limit === undefined) {
    filters.limit = 50;
  } else {
    if (typeof query.limit !== 'string' || !/^\d+$/.test(query.limit)) {
      return { error: 'limit must be an integer between 1 and 200' };
    }
    const limit = Number(query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      return { error: 'limit must be an integer between 1 and 200' };
    }
    filters.limit = limit;
  }
  return { filters };
}

export function createSecurityController({ store }) {
  return {
    getAlerts(req, res) {
      const parsed = parseFilters(req.query);
      if (parsed.error) {
        const result = validationError(parsed.error);
        return res.status(result.status).json(result.body);
      }

      return res.status(200).json(ok(
        { alerts: listAlerts(store, parsed.filters) },
        'Alerts retrieved successfully',
      ));
    },

    acknowledgeAlert(req, res) {
      const { id } = req.params;
      if (typeof id !== 'string' || !alertIdPattern.test(id)) {
        const result = validationError('alert ID must use the alt_#### format');
        return res.status(result.status).json(result.body);
      }

      const alert = acknowledgeAlert(store, id);
      if (!alert) {
        return res.status(404).json(fail('ALERT_NOT_FOUND', `Alert ${id} was not found`));
      }
      return res.status(200).json(ok(alert, 'Alert acknowledged successfully'));
    },
  };
}

export default createSecurityController;
