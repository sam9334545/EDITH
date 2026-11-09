import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { fail } from '../shared/contracts.js';

export const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Main API routing
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json(fail('NOT_FOUND', `Cannot ${req.method} ${req.url}`));
});

// Central error handler
app.use((err, req, res, next) => {
  const code = err.code || 'INTERNAL_ERROR';
  const status =
    code === 'VALIDATION_ERROR' || code === 'RESOURCE_INVALID'
      ? 400
      : code === 'APP_NOT_FOUND' || code === 'RECOMMENDATION_NOT_FOUND'
      ? 404
      : 500;

  res.status(status).json(fail(code, err.message || 'An unexpected error occurred'));
});

export default app;
