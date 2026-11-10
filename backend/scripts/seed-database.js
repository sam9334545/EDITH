import { loadEnvironment } from '../config/environment.js';

loadEnvironment();

const [{ connectDatabase, disconnectDatabase }, { seedApplications }] = await Promise.all([
  import('../database/connection.js'),
  import('../services/mongoService.js'),
]);
const { seedPostureDemoData } = await import('../services/demoDataService.js');
const { getPostureOverview } = await import('../services/postureService.js');

try {
  await connectDatabase();
  const count = await seedApplications();
  const posture = await seedPostureDemoData();
  const overview = await getPostureOverview({ days: 30 });
  console.log(`Database seed verified: ${count} applications, ${posture.events} demo events, ${overview.summary.openFindings} findings, ${posture.policies} posture policies`);
} finally {
  await disconnectDatabase();
}
