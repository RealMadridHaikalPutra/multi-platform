import type { FastifyReply, FastifyRequest } from "fastify";
import type { WebhookService } from "./webhook.service";

export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  handleShopee = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await this.webhookService.processShopeeWebhook(
      request.headers as Record<string, unknown>,
      request.body
    );

    reply.status(202).send({
      accepted: true,
      platform: "SHOPEE",
      eventId: result.eventId
    });
  };

  handleTikTok = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await this.webhookService.processTikTokWebhook(
      request.headers as Record<string, unknown>,
      request.body
    );

    reply.status(202).send({
      accepted: true,
      platform: "TIKTOK",
      eventId: result.eventId
    });
  };
}
