// Entry point: build the app and start listening.
import { buildApp } from './app.js';
import { config } from './config.js';
import { closePool } from './db/pool.js';

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown so Docker stop/restart is clean.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    await closePool();
    process.exit(0);
  });
}
