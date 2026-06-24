import { listLigands, getLigand } from '../services/ligands.js';

export default async function ligandRoutes(app) {
  // All ligand routes require a valid token.
  app.addHook('preHandler', app.authenticate);

  // GET /api/v1/ligands?search=atp
  app.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { search: { type: 'string', maxLength: 32 } },
        },
      },
    },
    async (request) => listLigands(request.query.search ?? ''),
  );

  // GET /api/v1/ligands/:id
  app.get(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1, maxLength: 16 } },
        },
      },
    },
    async (request, reply) => {
      const ligand = await getLigand(request.params.id);
      if (!ligand) {
        return reply
          .code(404)
          .send({ error: { code: 'not_found', message: `Unknown ligand '${request.params.id}'` } });
      }
      return ligand;
    },
  );
}
