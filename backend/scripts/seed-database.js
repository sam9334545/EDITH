import { loadEnvironment } from '../config/environment.js';

loadEnvironment();

const [{ connectDatabase, disconnectDatabase }, { seedApplications }] = await Promise.all([
  import('../database/connection.js'),
  import('../services/mongoService.js'),
]);

try {
  await connectDatabase();
  const count = await seedApplications();
  console.log(`Database seed verified: ${count} initial applications`);
} finally {
  await disconnectDatabase();
}
