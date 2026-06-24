import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

import { config } from './config.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';

// Builds and returns a configured Fastify instance (no .listen() — see index.js).
// Exported separately so tests can spin up the app without binding a port.
export async function buildApp(opts = {}) {
  const app = Fastify({ logger: true, ...opts });

  // The RN app runs from a different origin (device/emulator) — allow it.
  await app.register(cors, { origin: true });

  // JWT: adds reply.jwtSign() and request.jwtVerify().
  await app.register(jwt, { secret: config.jwtSecret });

  // Reusable guard for protected routes: `{ preHandler: app.authenticate }`.
  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        error: { code: 'unauthorized', message: 'Missing or invalid token' },
      });
    }
  });

  // One consistent error shape (matches API.md).
  app.setErrorHandler((err, request, reply) => {
    if (err.validation) {
      return reply
        .code(400)
        .send({ error: { code: 'validation_error', message: err.message } });
    }
    // Expected, client-facing errors carry their own status/code/message.
    if (err.expose && err.statusCode) {
      return reply
        .code(err.statusCode)
        .send({ error: { code: err.code ?? 'error', message: err.message } });
    }
    // Everything else is unexpected: log it, don't leak details.
    request.log.error(err);
    reply
      .code(err.statusCode ?? 500)
      .send({ error: { code: 'internal_error', message: 'Internal server error' } });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: { code: 'not_found', message: `Route ${request.method} ${request.url} not found` },
    });
  });

  // Routes — backend is auth-only; ligand fetch/parse lives in the RN app.
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  return app;
}
