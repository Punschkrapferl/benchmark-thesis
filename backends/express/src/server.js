import app from './app.js';
import env from './config/env.js';
import { closeDatabasePool, testDatabaseConnection } from './config/database.js';

let server;

async function startServer() {
  await testDatabaseConnection();

  server = app.listen(env.port, () => {
    console.log(`Express backend listening on port ${env.port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    await closeDatabasePool();
    process.exit(0);
  } catch (error) {
    console.error('Shutdown error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});