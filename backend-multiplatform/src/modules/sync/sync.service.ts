import { randomUUID } from "node:crypto";
import type IORedis from "ioredis";
import type { FastifyBaseLogger } from "fastify";
import type { ShopeeClient } from "../../infrastructure/external/shopee.client";
import type { TikTokClient } from "../../infrastructure/external/tiktok.client";
import { PLATFORM, type PlatformName } from "../../shared/types/platform";
import type { QueueService } from "../queue/queue.service";
import type { InventoryService } from "../inventory/inventory.service";
import type { ObservabilityService } from "../observability/observability.service";
import { SyncRepository } from "./sync.repository";

export interface PollResultSummary {
  marketplace: PlatformName;
  queuedOrders: number;
  queuedStockUpdates: number;
  nextCursor?: string;
}

export class SyncService {
  private readonly syncRepository: SyncRepository;

  constructor(
    private readonly queueService: QueueService,
    private readonly inventoryService: InventoryService,
    private readonly shopeeClient: ShopeeClient,
    private readonly tiktokClient: TikTokClient,
    private readonly metrics: ObservabilityService,
    private readonly redis: IORedis,
    private readonly log: FastifyBaseLogger
  ) {
    this.syncRepository = new SyncRepository();
  }

  async enqueuePollingFallbackJobs(): Promise<void> {
    const now = new Date().toISOString();
    const [shopeeCursor, tiktokCursor] = await Promise.all([
      this.redis.get(this.cursorKey(PLATFORM.SHOPEE)),
      this.redis.get(this.cursorKey(PLATFORM.TIKTOK))
    ]);

    await Promise.all([
      this.queueService.enqueuePolling({
        type: "POLL_MARKETPLACE",
        eventId: randomUUID(),
        platform: PLATFORM.SHOPEE,
        marketplace: PLATFORM.SHOPEE,
        cursor: shopeeCursor ?? undefined,
        receivedAt: now
      }),
      this.queueService.enqueuePolling({
        type: "POLL_MARKETPLACE",
        eventId: randomUUID(),
        platform: PLATFORM.TIKTOK,
        marketplace: PLATFORM.TIKTOK,
        cursor: tiktokCursor ?? undefined,
        receivedAt: now
      })
    ]);
  }

  async pollMarketplace(marketplace: PlatformName, cursor?: string): Promise<PollResultSummary> {
    const client = marketplace === PLATFORM.SHOPEE ? this.shopeeClient : this.tiktokClient;
    const response = await client.pollEvents(cursor);

    for (const order of response.orders) {
      await this.syncRepository.recordEvent({
        eventId: order.eventId,
        platform: marketplace,
        source: "POLLING",
        eventType: "ORDER_UPSERT",
        sku: order.sku,
        payload: order
      });

      await this.queueService.enqueueOrderUpsert({
        type: "ORDER_UPSERT",
        eventId: order.eventId,
        platform: marketplace,
        receivedAt: new Date().toISOString(),
        sku: order.sku,
        orderId: order.orderId,
        quantity: order.quantity,
        status: order.status,
        rawPayload: order
      });
    }

    for (const stock of response.stockUpdates) {
      await this.syncRepository.recordEvent({
        eventId: stock.eventId,
        platform: marketplace,
        source: "POLLING",
        eventType: "STOCK_ADJUST",
        sku: stock.sku,
        payload: stock
      });

      await this.queueService.enqueueStockAdjustment({
        type: "STOCK_ADJUST",
        eventId: stock.eventId,
        platform: marketplace,
        receivedAt: new Date().toISOString(),
        sku: stock.sku,
        delta: stock.delta,
        reason: stock.reason,
        rawPayload: stock
      });

      await this.captureConsistency(marketplace, stock.sku);
    }

    if (response.cursor) {
      await this.redis.set(this.cursorKey(marketplace), response.cursor);
    }

    const result: PollResultSummary = {
      marketplace,
      queuedOrders: response.orders.length,
      queuedStockUpdates: response.stockUpdates.length,
      nextCursor: response.cursor
    };

    this.log.info({ result }, "polling completed");
    return result;
  }

  async markEventProcessed(eventId: string): Promise<void> {
    await this.syncRepository.markProcessed(eventId);
  }

  async recordWebhookEvent(input: {
    eventId: string;
    platform: PlatformName;
    eventType: string;
    sku?: string;
    payload: unknown;
  }): Promise<void> {
    await this.syncRepository.recordEvent({
      eventId: input.eventId,
      platform: input.platform,
      source: "WEBHOOK",
      eventType: input.eventType,
      sku: input.sku,
      payload: input.payload
    });
  }

  async getUnprocessedEvents(limit = 100): Promise<Array<Record<string, unknown>>> {
    return this.syncRepository.getUnprocessed(limit);
  }

  private async captureConsistency(platform: PlatformName, sku: string): Promise<void> {
    const client = platform === PLATFORM.SHOPEE ? this.shopeeClient : this.tiktokClient;
    const [centralQty, platformQty] = await Promise.all([
      this.inventoryService.getQuantityOrZero(sku),
      client.getStockBySku(sku)
    ]);

    await this.metrics.recordConsistency({
      platform,
      sku,
      centralQty,
      platformQty,
      note: "consistency snapshot during polling fallback"
    });
  }

  private cursorKey(platform: PlatformName): string {
    return `sync:cursor:${platform}`;
  }
}
