import { Router } from 'express';
import { fail, ok } from '../../shared/contracts.js';
import { databaseHealth } from '../database/connection.js';

const router = Router();
const startTime = Date.now();

router.get('/', (req, res) => {
  const uptime = Number(((Date.now() - startTime) / 1000).toFixed(1));
  const database = databaseHealth();
  if (!database.connected) {
    return res.status(503).json(fail('DATABASE_UNAVAILABLE', 'Database is unavailable'));
  }
  return res.status(200).json(
    ok(
      {
        status: 'ok',
        uptime,
        simulated: true,
        database: database.status,
      },
      'Health check successful'
    )
  );
});

export default router;
