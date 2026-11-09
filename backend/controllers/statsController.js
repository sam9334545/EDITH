import store from '../store/index.js';
import { ok } from '../../shared/contracts.js';

export const getStats = (req, res) => {
  const apps = store.apps;
  const events = store.events;
  const alerts = store.alerts;

  const totalApps = apps.length;
  const allowedRequests = events.filter((e) => e.status === 'allowed').length;
  const deniedRequests = events.filter((e) => e.status === 'denied').length;
  const activeAlerts = alerts.filter((a) => !a.acknowledged).length;

  const totalScore = apps.reduce((sum, a) => sum + (a.trustScore || 0), 0);
  const averageTrustScore = totalApps > 0 ? Math.round(totalScore / totalApps) : 0;

  return res.status(200).json(
    ok(
      {
        totalApps,
        allowedRequests,
        deniedRequests,
        activeAlerts,
        averageTrustScore,
      },
      'Dashboard stats retrieved successfully'
    )
  );
};

export default { getStats };
