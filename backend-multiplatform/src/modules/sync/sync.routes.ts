import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const UnprocessedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.post("/sync/poll/trigger", async (_request, reply) => {
    await app.syncService.enqueuePollingFallbackJobs();

    reply.status(202).send({
      accepted: true,
      message: "polling jobs enqueued"
    });
  });

  app.get("/sync/events/unprocessed", async (request) => {
    const query = UnprocessedQuerySchema.parse(request.query);
    return app.syncService.getUnprocessedEvents(query.limit);
  });
};
