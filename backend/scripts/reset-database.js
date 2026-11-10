import { loadEnvironment } from '../config/environment.js';

loadEnvironment();

const [{ connectDatabase, disconnectDatabase }, { resetDemoData }] = await Promise.all([
  import('../database/connection.js'),
  import('../services/mongoService.js'),
]);

try {
  await connectDatabase();
  await resetDemoData();
  console.log('Development database reset completed');
} finally {
  await disconnectDatabase();
}
