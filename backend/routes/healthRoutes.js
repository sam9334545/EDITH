import { Router } from 'express';
import { ok } from '../../shared/contracts.js';

const router = Router();
const startTime = Date.now();

router.get('/', (req, res) => {
  const uptime = Number(((Date.now() - startTime) / 1000).toFixed(1));
  return res.status(200).json(
    ok(
      {
        status: 'ok',
        uptime,
        simulated: true,
      },
      'Health check successful'
    )
  );
});

export default router;
