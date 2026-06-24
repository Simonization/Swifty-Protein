import { allElements, getElement } from '../services/elements.js';

// Reference data — public (no auth) so CPK colors load even on the login screen.
export default async function elementRoutes(app) {
  // GET /api/v1/elements
  app.get('/', async () => ({ elements: allElements() }));

  // GET /api/v1/elements/:symbol
  app.get(
    '/:symbol',
    {
      schema: {
        params: {
          type: 'object',
          required: ['symbol'],
          properties: { symbol: { type: 'string', minLength: 1, maxLength: 3 } },
        },
      },
    },
    async (request, reply) => {
      const element = getElement(request.params.symbol);
      if (!element) {
        return reply
          .code(404)
          .send({ error: { code: 'not_found', message: `Unknown element '${request.params.symbol}'` } });
      }
      return element;
    },
  );
}
