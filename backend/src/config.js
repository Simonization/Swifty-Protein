// Central config, read once from the environment.
const DEV_SECRET = 'dev-only-insecure-secret-change-me';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? DEV_SECRET,
  databaseUrl: process.env.DATABASE_URL ?? null,
  upstreamTimeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 8000),
  isProd: process.env.NODE_ENV === 'production',
};

// Fail loud if someone ships the dev secret to production.
if (config.isProd && config.jwtSecret === DEV_SECRET) {
  throw new Error('JWT_SECRET must be set to a real secret in production');
}
