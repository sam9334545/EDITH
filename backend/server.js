import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS for Vite frontend
app.use(cors({ origin: 'http://localhost:5173' }));

// Parse JSON request bodies
app.use(express.json());

// Mount API routes
app.use('/api', routes);

// Start server
const server = app.listen(PORT, () => {
  console.log(`E.D.I.T.H. backend server running on http://localhost:${PORT}`);
});

export { app, server };
export default app;

