import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PLATFORM } from "../../shared/types/platform";
import type { InitialSyncService } from "./initial-sync.service";

const ImportBodySchema = z.object({
  platforms: z.array(z.enum([PLATFORM.SHOPEE, PLATFORM.TIKTOK])).optional()
});

const MarketplaceQuerySchema = z.object({
  platform: z.enum([PLATFORM.SHOPEE, PLATFORM.TIKTOK]).optional()
});

const LinkBodySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().nonnegative().default(0),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  links: z.array(
    z.object({
      platform: z.enum([PLATFORM.SHOPEE, PLATFORM.TIKTOK]),
      externalId: z.string().min(1)
    })
  ).min(1)
});

const NormalizeBodySchema = z.object({
  sku: z.string().min(1),
  stockSource: z.enum([PLATFORM.SHOPEE, PLATFORM.TIKTOK, "MANUAL"]),
  manualStock: z.number().int().nonnegative().optional()
});

export class InitialSyncController {
  constructor(private readonly initialSyncService: InitialSyncService) {}

  import = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = ImportBodySchema.parse(request.body ?? {});
    const data = await this.initialSyncService.importMarketplaceProducts(body.platforms);
    reply.status(202).send({
      accepted: true,
      results: data
    });
  };

  listMarketplaceProducts = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = MarketplaceQuerySchema.parse(request.query ?? {});
    const data = await this.initialSyncService.listMarketplaceProducts(query.platform);
    reply.send(data);
  };

  link = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = LinkBodySchema.parse(request.body);
    const data = await this.initialSyncService.linkProducts(body);
    reply.send(data);
  };

  normalize = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = NormalizeBodySchema.parse(request.body);
    const data = await this.initialSyncService.normalizeStock(body);
    reply.send(data);
  };
}
