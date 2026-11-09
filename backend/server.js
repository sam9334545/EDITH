// Load .env if present (supported natively in Node.js 20.12+)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Optional .env file; falls back to defaults
  }
}

import app from './app.js';

const PORT = process.env.PORT || 4000;

// Start server
const server = app.listen(PORT, () => {
  console.log(`E.D.I.T.H. backend server running on http://localhost:${PORT}`);
});

export { app, server };
export default app;
