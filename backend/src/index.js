// Entry point: build the app and start listening.
import { buildApp } from './app.js';
import { config } from './config.js';
import { closePool } from './db/pool.js';

const app = await buildApp();

// Registered *before* listen(), not after: `docker compose up` immediately
// followed by `down`, or a slow Postgres handshake, can deliver the signal
// while we are still binding — and the default handler would kill the process
// with the pool still open. The guard makes a second Ctrl-C a no-op rather than
// a re-entrant app.close().
let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await app.close();
      await closePool();
    } catch (err) {
      app.log.error(err);
    }
    process.exit(0);
  });
}

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
