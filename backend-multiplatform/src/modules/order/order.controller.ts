import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PLATFORM } from "../../shared/types/platform";
import type { OrderService } from "./order.service";

const OrderIdParamsSchema = z.object({
  id: z.string().uuid()
});

const ExternalOrderParamsSchema = z.object({
  externalOrderId: z.string().min(1)
});

const UpsertOrderBodySchema = z.object({
  platform: z.enum([PLATFORM.SHOPEE, PLATFORM.TIKTOK]),
  externalOrderId: z.string().min(1).optional(),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  status: z.string().min(1),
  rawPayload: z.unknown().optional()
});

export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.orderService.listOrders();
    reply.send(data);
  };

  get = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = OrderIdParamsSchema.parse(request.params);
    const data = await this.orderService.getOrderById(params.id);
    reply.send(data);
  };

  create = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = UpsertOrderBodySchema.parse(request.body);
    const eventId = randomUUID();
    const externalOrderId = body.externalOrderId ?? eventId;

    const job = await request.server.queueService.enqueueOrderUpsert({
      type: "ORDER_UPSERT",
      eventId,
      platform: body.platform,
      receivedAt: new Date().toISOString(),
      sku: body.sku,
      orderId: externalOrderId,
      quantity: body.quantity,
      status: body.status,
      rawPayload: body.rawPayload ?? body
    });

    reply.status(202).send({
      accepted: true,
      jobId: job.id,
      eventId,
      externalOrderId
    });
  };

  upsertByExternal = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = ExternalOrderParamsSchema.parse(request.params);
    const body = UpsertOrderBodySchema.parse(request.body);
    const eventId = randomUUID();

    const job = await request.server.queueService.enqueueOrderUpsert({
      type: "ORDER_UPSERT",
      eventId,
      platform: body.platform,
      receivedAt: new Date().toISOString(),
      sku: body.sku,
      orderId: params.externalOrderId,
      quantity: body.quantity,
      status: body.status,
      rawPayload: body.rawPayload ?? body
    });

    reply.status(202).send({
      accepted: true,
      jobId: job.id,
      eventId,
      externalOrderId: params.externalOrderId
    });
  };

  remove = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = OrderIdParamsSchema.parse(request.params);
    await this.orderService.deleteOrder(params.id);
    reply.status(204).send();
  };
}
