// Server entry point for E.D.I.T.H.
import app from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`E.D.I.T.H. backend running on port ${PORT}`);
});
