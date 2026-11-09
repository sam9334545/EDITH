import { createSecurityController } from '../controllers/securityController.js';

export function createSecurityRouter({ Router, store }) {
  if (typeof Router !== 'function') {
    throw new TypeError('Router must be an Express Router factory');
  }
  const router = Router();
  const controller = createSecurityController({ store });

  router.get('/alerts', controller.getAlerts);
  router.patch('/alerts/:id/acknowledge', controller.acknowledgeAlert);
  return router;
}

export default createSecurityRouter;
