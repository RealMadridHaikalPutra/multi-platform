import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PLATFORM } from "../../shared/types/platform";
import type { IntegrationService } from "./integration.service";

const IntegrationParamsSchema = z.object({
  platform: z.enum([PLATFORM.SHOPEE, PLATFORM.TIKTOK])
});

const IntegrationBodySchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  webhookSecret: z.string().min(1)
});

export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.integrationService.listIntegrations();
    reply.send(data);
  };

  upsert = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = IntegrationParamsSchema.parse(request.params);
    const body = IntegrationBodySchema.parse(request.body);
    const data = await this.integrationService.upsertIntegration(params.platform, body);
    reply.send(data);
  };
}
