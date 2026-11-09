// Server entry point for E.D.I.T.H.
// Automatically loads .env if present (built into Node.js 20.12+)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Optional .env file; fall back to defaults
  }
}

import app from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`E.D.I.T.H. backend running on port ${PORT}`);
});
