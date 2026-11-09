import app from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[E.D.I.T.H. Backend] Running on http://localhost:${PORT}`);
  console.log(`[E.D.I.T.H. Backend] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[E.D.I.T.H. Backend] Activity History: http://localhost:${PORT}/api/history`);
});
