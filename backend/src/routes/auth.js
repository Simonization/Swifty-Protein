import * as userStore from '../services/userStore.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

// Shared schema for register/login bodies.
const credentialsSchema = {
  type: 'object',
  required: ['username', 'password'],
  additionalProperties: false,
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 32 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
  },
};

export default async function authRoutes(app) {
  const signToken = (reply, user) =>
    reply.jwtSign({ sub: user.id, username: user.username });

  // POST /api/v1/auth/register
  app.post('/register', { schema: { body: credentialsSchema } }, async (request, reply) => {
    const { username, password } = request.body;

    if (userStore.findByUsername(username)) {
      return reply
        .code(409)
        .send({ error: { code: 'username_taken', message: 'Username already registered' } });
    }

    const user = userStore.createUser({ username, passwordHash: await hashPassword(password) });
    const token = await signToken(reply, user);
    return reply.code(201).send({ token, user: userStore.toPublic(user) });
  });

  // POST /api/v1/auth/login
  app.post('/login', { schema: { body: credentialsSchema } }, async (request, reply) => {
    const { username, password } = request.body;
    const user = userStore.findByUsername(username);

    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      return reply
        .code(401)
        .send({ error: { code: 'invalid_credentials', message: 'Wrong username or password' } });
    }

    const token = await signToken(reply, user);
    return reply.send({ token, user: userStore.toPublic(user) });
  });

  // GET /api/v1/auth/me — validate token / fetch current user.
  app.get('/me', { preHandler: app.authenticate }, async (request) => {
    const user = userStore.findById(request.user.sub);
    return { user: userStore.toPublic(user) };
  });
}
