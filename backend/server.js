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
const rawOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = rawOrigin.split(',').map((o) => o.trim());

// Configure middleware
app.use(cors({
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
}));
app.use(express.json());

// Mount the main router at /api
app.use('/api', routes);

// Start the server
const server = app.listen(PORT, () => {
  console.log(`E.D.I.T.H. backend server running on http://localhost:${PORT}`);
});

export { app, server };
export default app;
