import type { FastifyPluginAsync } from "fastify";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";

/**
 * Webhook endpoints are the primary synchronization source.
 * Each accepted event is persisted as sync_events and enqueued to BullMQ.
 * Polling fallback (scheduled every 5 minutes) backfills missed events.
 */
export const webhookRoutes: FastifyPluginAsync = async (app) => {
  const webhookService = new WebhookService(app.queueService, app.syncService, app.integrationService);
  const controller = new WebhookController(webhookService);

  app.post("/webhooks/shopee", controller.handleShopee);
  app.post("/webhooks/tiktok", controller.handleTikTok);
};
