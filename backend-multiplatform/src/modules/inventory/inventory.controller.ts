import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PLATFORM } from "../../shared/types/platform";
import type { InventoryService } from "./inventory.service";

const InventorySkuParamsSchema = z.object({
  sku: z.string().min(1)
});

const SetQuantityBodySchema = z.object({
  quantity: z.number().int().nonnegative(),
  platform: z.enum([PLATFORM.SHOPEE, PLATFORM.TIKTOK]).default(PLATFORM.SHOPEE),
  reason: z.string().min(1).default("manual-set")
});

const AdjustStockBodySchema = z.object({
  delta: z.number().int(),
  platform: z.enum([PLATFORM.SHOPEE, PLATFORM.TIKTOK]).default(PLATFORM.SHOPEE),
  reason: z.string().min(1).default("manual-adjust")
});

export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.inventoryService.listInventory();
    reply.send(data);
  };

  get = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = InventorySkuParamsSchema.parse(request.params);
    const data = await this.inventoryService.getInventoryBySku(params.sku);
    reply.send(data);
  };

  setQuantity = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = InventorySkuParamsSchema.parse(request.params);
    const body = SetQuantityBodySchema.parse(request.body);

    const eventId = randomUUID();
    const job = await request.server.queueService.enqueueStockSet({
      eventId,
      platform: body.platform,
      receivedAt: new Date().toISOString(),
      sku: params.sku,
      quantity: body.quantity,
      reason: body.reason,
      rawPayload: body,
      type: "STOCK_SET"
    });

    reply.status(202).send({
      accepted: true,
      jobId: job.id,
      eventId
    });
  };

  adjust = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = InventorySkuParamsSchema.parse(request.params);
    const body = AdjustStockBodySchema.parse(request.body);

    const eventId = randomUUID();
    const job = await request.server.queueService.enqueueStockAdjustment({
      eventId,
      platform: body.platform,
      receivedAt: new Date().toISOString(),
      sku: params.sku,
      delta: body.delta,
      reason: body.reason,
      rawPayload: body,
      type: "STOCK_ADJUST"
    });

    reply.status(202).send({
      accepted: true,
      jobId: job.id,
      eventId
    });
  };

  remove = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = InventorySkuParamsSchema.parse(request.params);
    await this.inventoryService.removeInventoryBySku(params.sku);
    reply.status(204).send();
  };
}
