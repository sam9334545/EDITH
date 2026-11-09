// Load .env if present (supported natively in Node.js 20.12+)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Optional .env file; falls back to defaults
  }
}

import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Configure middleware
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Mount the main router at /api
app.use('/api', routes);

// Start the server
const server = app.listen(PORT, () => {
  console.log(`E.D.I.T.H. backend server running on http://localhost:${PORT}`);
});

export { app, server };
export default app;
