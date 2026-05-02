import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { PLATFORM } from "../../shared/types/platform";

const ConsistencyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50)
});

const LatencyQuerySchema = z.object({
  minutes: z.coerce.number().int().min(1).max(24 * 60).default(60)
});

const BenchmarkBodySchema = z.object({
  platform: z.enum([PLATFORM.SHOPEE, PLATFORM.TIKTOK]).default(PLATFORM.SHOPEE),
  skuPrefix: z.string().min(1).default("BENCH-SKU"),
  skuCount: z.number().int().min(1).max(500).default(10),
  jobsPerSku: z.number().int().min(1).max(1_000).default(20),
  delta: z.number().int().default(-1)
});

export const observabilityRoutes: FastifyPluginAsync = async (app) => {
  app.get("/observability/health", async () => {
    const queue = await app.queueService.getQueueCounts();
    return {
      status: "ok",
      uptimeSec: process.uptime(),
      queue
    };
  });

  app.get("/observability/metrics", async () => {
    return app.metrics.getMetricsSnapshot();
  });

  app.get("/observability/consistency", async (request) => {
    const query = ConsistencyQuerySchema.parse(request.query);
    return app.metrics.getRecentConsistency(query.limit);
  });

  app.get("/observability/latency", async (request) => {
    const query = LatencyQuerySchema.parse(request.query);
    return app.metrics.getLatencySummary(query.minutes);
  });

  app.post("/observability/benchmark/sync", async (request, reply) => {
    const body = BenchmarkBodySchema.parse(request.body);
    const enqueuedAt = new Date().toISOString();

    let totalJobs = 0;
    for (let skuIdx = 1; skuIdx <= body.skuCount; skuIdx += 1) {
      const sku = `${body.skuPrefix}-${skuIdx}`;
      for (let jobIdx = 1; jobIdx <= body.jobsPerSku; jobIdx += 1) {
        totalJobs += 1;
        await app.queueService.enqueueStockAdjustment({
          type: "STOCK_ADJUST",
          eventId: randomUUID(),
          platform: body.platform,
          receivedAt: enqueuedAt,
          sku,
          delta: body.delta,
          reason: "benchmark-load",
          rawPayload: {
            sku,
            index: jobIdx
          }
        });
      }
    }

    reply.status(202).send({
      accepted: true,
      totalJobs,
      platform: body.platform
    });
  });
};
