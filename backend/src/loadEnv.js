// Loads backend/.env when it exists, for local development only.
//
// This used to be `node --env-file-if-exists=.env`, which cannot be combined
// with `--watch`: watch mode registers every file named by an --env-file flag,
// and registering one that does not exist throws ENOENT from the supervisor.
// The child had already bound the port by then, so `npm run dev` on a fresh
// clone looked like a crash *and* left an orphan holding :3000.
//
// Preloaded with `--import`, so it runs before src/index.js pulls in config.js.
// `npm start` deliberately does not preload it: in Docker the environment comes
// from compose, and a stray .env in an image should not quietly override it.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env is the normal case — accounts are in-memory and the defaults apply.
}
