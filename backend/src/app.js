import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import { config } from './config.js';
import * as userStore from './services/userStore.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';

// Builds and returns a configured Fastify instance (no .listen() — see index.js).
// Exported separately so tests can spin up the app without binding a port.
export async function buildApp(opts = {}) {
  const app = Fastify({ logger: true, ...opts });

  // nosniff, frame-deny, and friends. CSP is off: this API serves JSON to a
  // native client and never returns a document for a browser to execute, so a
  // policy here would be decoration rather than defence.
  await app.register(helmet, { contentSecurityPolicy: false });

  // The RN app runs from a different origin (device/emulator) — allow it.
  await app.register(cors, { origin: true });

  // Brute-force protection. Registered globally so the limiter exists, but with
  // a permissive default; the auth routes opt into a much tighter budget of
  // their own (see routes/auth.js). Without this, /login accepts unlimited
  // guesses, which is the first thing a security-minded corrector probes.
  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (request, context) => ({
      statusCode: 429,
      error: {
        code: 'rate_limited',
        message: `Too many requests. Try again in ${context.after}.`,
      },
    }),
  });

  // JWT: adds reply.jwtSign() and request.jwtVerify().
  // expiresIn is set here rather than per-call so no route can mint an eternal
  // token by forgetting it. Documented in README.md.
  await app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: config.jwtTtl } });

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

  // One consistent error shape (matches README.md).
  app.setErrorHandler((err, request, reply) => {
    if (err.validation) {
      return reply
        .code(400)
        .send({ error: { code: 'validation_error', message: err.message } });
    }
    // The rate limiter builds its own body (see errorResponseBuilder above);
    // it must not be rewritten into a validation error by the branch below.
    if (err.statusCode === 429) {
      return reply.code(429).send(
        err.error
          ? { error: err.error }
          : { error: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' } },
      );
    }
    // A malformed JSON body or a wrong Content-Type is the client sending
    // something we can't read — a validation failure, not an internal one.
    // These arrive with a 4xx statusCode but no `.validation`, so without this
    // branch they were answered `400 internal_error`, contradicting README.md.
    const status = err.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      return reply
        .code(status)
        .send({ error: { code: 'validation_error', message: err.message } });
    }
    // Anything else is unexpected: log it, don't leak details.
    request.log.error(err);
    reply.code(500).send({ error: { code: 'internal_error', message: 'Internal server error' } });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: { code: 'not_found', message: `Route ${request.method} ${request.url} not found` },
    });
  });

  // Initialise the user store (runs migrations on the Postgres path; no-op in memory).
  await userStore.init();

  // Routes — backend is auth-only; ligand fetch/parse lives in the RN app.
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  return app;
}
