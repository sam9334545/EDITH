// Express Application Setup for E.D.I.T.H.
import express from 'express';
import cors from 'cors';
import { fail } from '../shared/contracts.js';
import { loadEnvironment } from './config/environment.js';
import { databaseHealth } from './database/connection.js';
import raspMiddleware from './middleware/raspMiddleware.js';
import routes from './routes/index.js';

loadEnvironment();

const app = express();
const rawOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = rawOrigin.split(',').map((origin) => origin.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      const url = new URL(origin);
      if (
        rawOrigin === '*'
        || allowedOrigins.includes('*')
        || allowedOrigins.includes(origin)
        || /\.vercel\.app$/.test(url.hostname)
        || /^localhost(:\d+)?$/.test(url.host)
      ) {
        return callback(null, true);
      }
    } catch {
      // Preserve the main-branch CORS fallback for malformed origins.
    }
    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(raspMiddleware);

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (!databaseHealth().connected) {
    return res.status(503).json(fail('DATABASE_UNAVAILABLE', 'Database is unavailable'));
  }
  return next();
});

app.use('/api', routes);

app.use((req, res) => {
  return res.status(404).json(fail('NOT_FOUND', `Route ${req.method} ${req.url} not found`));
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json(fail('VALIDATION_ERROR', 'Request body must contain valid JSON'));
  }

  const validation = error.code === 'VALIDATION_ERROR'
    || error.code === 'RESOURCE_INVALID'
    || error.name === 'ValidationError'
    || error.name === 'CastError';
  const notFound = [
    'APP_NOT_FOUND',
    'RECOMMENDATION_NOT_FOUND',
    'ALERT_NOT_FOUND',
    'FINDING_NOT_FOUND',
    'POLICY_NOT_FOUND',
    'INCIDENT_NOT_FOUND',
  ].includes(error.code);
  const resetDisabled = error.code === 'RESET_DISABLED';
  const databaseUnavailable = [
    'MongooseServerSelectionError',
    'MongoNetworkError',
    'MongoNotConnectedError',
  ].includes(error.name);
  const status = validation ? 400 : notFound ? 404 : resetDisabled ? 403 : databaseUnavailable ? 503 : 500;
  const code = validation
    ? error.code || 'VALIDATION_ERROR'
    : notFound
      ? error.code
      : resetDisabled
        ? error.code
        : databaseUnavailable
          ? 'DATABASE_UNAVAILABLE'
          : 'INTERNAL_ERROR';
  const message = status === 500
    ? 'Internal server error'
    : databaseUnavailable
      ? 'Database is unavailable'
      : error.message;

  if (status >= 500) console.error(`Request failed: ${error.name || 'Error'}`);
  return res.status(status).json(fail(code, message));
});

export { app };
export default app;
