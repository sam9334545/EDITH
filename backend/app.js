// Express Application Setup for E.D.I.T.H.
import express from 'express';
import cors from 'cors';
import { fail } from '../shared/contracts.js';
import raspMiddleware from './middleware/raspMiddleware.js';
import routes from './routes/index.js';

const app = express();

const rawOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = rawOrigin.split(',').map((o) => o.trim());

// Configure CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const url = new URL(origin);
        if (
          rawOrigin === '*' ||
          allowedOrigins.includes('*') ||
          allowedOrigins.includes(origin) ||
          /\.vercel\.app$/.test(url.hostname) ||
          /^localhost(:\d+)?$/.test(url.host)
        ) {
          return callback(null, true);
        }
      } catch {
        // Fallback
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Body parsing with safe size limit
app.use(express.json({ limit: '100kb' }));

// RASP: inline request inspection. Must come AFTER body parsing and BEFORE any route.
app.use(raspMiddleware);

// Mount central API routes
app.use('/api', routes);

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

export { app };
export default app;
