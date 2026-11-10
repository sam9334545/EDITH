import { pathToFileURL } from 'node:url';
import path from 'node:path';
import app from './app.js';
import { loadEnvironment } from './config/environment.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { seedApplications } from './services/mongoService.js';
import { seedPostureDemoData } from './services/demoDataService.js';
import { getPostureOverview } from './services/postureService.js';

loadEnvironment();

const port = Number(process.env.PORT || 4000);
export let server;
let shuttingDown = false;

export async function startServer() {
  await connectDatabase();
  await seedApplications();
  await seedPostureDemoData();
  await getPostureOverview({ days: 30 });

  server = app.listen(port);
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
  } catch (error) {
    server = undefined;
    throw error;
  }

  console.log(`E.D.I.T.H. backend listening on port ${port}`);
  return server;
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down`);

  try {
    if (server) {
      const activeServer = server;
      server = undefined;
      await new Promise((resolve, reject) => {
        activeServer.close((error) => error ? reject(error) : resolve());
      });
    }
  } finally {
    await disconnectDatabase();
  }
}

process.once('SIGINT', () => shutdown('SIGINT').catch((error) => {
  console.error(`Shutdown failed: ${error.name}`);
  process.exitCode = 1;
}));
process.once('SIGTERM', () => shutdown('SIGTERM').catch((error) => {
  console.error(`Shutdown failed: ${error.name}`);
  process.exitCode = 1;
}));

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer().catch(async (error) => {
    const details = error.code === 'MONGODB_URI_REQUIRED'
      ? `${error.code}: ${error.message}`
      : `${error.name}${error.code ? ` (${error.code})` : ''}`;
    console.error(`Backend startup failed: ${details}`);
    await disconnectDatabase().catch((disconnectError) => {
      console.error(`Database cleanup failed: ${disconnectError.name}`);
    });
    process.exitCode = 1;
  });
}

export { app };
export default app;
