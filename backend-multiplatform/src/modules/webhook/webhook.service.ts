import { DomainError } from "../../shared/errors/domain-error";
import { PLATFORM } from "../../shared/types/platform";
import { createHmacHex, safeEqualHex } from "../../shared/utils/crypto";
import type { IntegrationService } from "../integration/integration.service";
import type { QueueService } from "../queue/queue.service";
import type { SyncService } from "../sync/sync.service";
import {
  ShopeeWebhookSchema,
  TikTokWebhookSchema,
  type ShopeeWebhookPayload,
  type TikTokWebhookPayload
} from "./webhook.schemas";

export class WebhookService {
  constructor(
    private readonly queueService: QueueService,
    private readonly syncService: SyncService,
    private readonly integrationService: IntegrationService
  ) {}

  async processShopeeWebhook(headers: Record<string, unknown>, body: unknown): Promise<{ eventId: string }> {
    const payload = ShopeeWebhookSchema.parse(body);
    const secret = await this.integrationService.requireWebhookSecret(PLATFORM.SHOPEE);
    this.validateSignature(headers, payload, secret, "x-shopee-signature");

    if (payload.event_type === "ORDER_STATUS") {
      await this.enqueueShopeeOrder(payload);
      return { eventId: payload.event_id };
    }

    await this.enqueueShopeeStock(payload);
    return { eventId: payload.event_id };
  }

  async processTikTokWebhook(headers: Record<string, unknown>, body: unknown): Promise<{ eventId: string }> {
    const payload = TikTokWebhookSchema.parse(body);
    const secret = await this.integrationService.requireWebhookSecret(PLATFORM.TIKTOK);
    this.validateSignature(headers, payload, secret, "x-tiktok-signature");

    if (payload.type === "ORDER_STATUS_CHANGED") {
      await this.enqueueTikTokOrder(payload);
      return { eventId: payload.event_id };
    }

    await this.enqueueTikTokStock(payload);
    return { eventId: payload.event_id };
  }

  private validateSignature(
    headers: Record<string, unknown>,
    payload: unknown,
    secret: string,
    signatureHeader: string
  ): void {
    const incoming = String(headers[signatureHeader] ?? "");
    if (!incoming) {
      throw new DomainError("Missing webhook signature", 401, "WEBHOOK_SIGNATURE_MISSING");
    }

    const rawPayload = JSON.stringify(payload);
    const expected = createHmacHex(secret, rawPayload);
    const valid = safeEqualHex(incoming, expected);

    if (!valid) {
      throw new DomainError("Invalid webhook signature", 401, "WEBHOOK_SIGNATURE_INVALID");
    }
  }

  private async enqueueShopeeOrder(payload: ShopeeWebhookPayload): Promise<void> {
    if (!payload.data.order_id || !payload.data.sku || !payload.data.quantity || !payload.data.status) {
      throw new DomainError("Invalid Shopee order payload", 400, "INVALID_SHOPEE_ORDER_PAYLOAD");
    }

    await this.syncService.recordWebhookEvent({
      eventId: payload.event_id,
      platform: PLATFORM.SHOPEE,
      eventType: payload.event_type,
      sku: payload.data.sku,
      payload
    });

    await this.queueService.enqueueOrderUpsert({
      type: "ORDER_UPSERT",
      eventId: payload.event_id,
      platform: PLATFORM.SHOPEE,
      receivedAt: new Date().toISOString(),
      sku: payload.data.sku,
      orderId: payload.data.order_id,
      quantity: payload.data.quantity,
      status: payload.data.status,
      rawPayload: payload
    });
  }

  private async enqueueShopeeStock(payload: ShopeeWebhookPayload): Promise<void> {
    if (!payload.data.sku || payload.data.delta === undefined) {
      throw new DomainError("Invalid Shopee stock payload", 400, "INVALID_SHOPEE_STOCK_PAYLOAD");
    }

    await this.syncService.recordWebhookEvent({
      eventId: payload.event_id,
      platform: PLATFORM.SHOPEE,
      eventType: payload.event_type,
      sku: payload.data.sku,
      payload
    });

    await this.queueService.enqueueStockAdjustment({
      type: "STOCK_ADJUST",
      eventId: payload.event_id,
      platform: PLATFORM.SHOPEE,
      receivedAt: new Date().toISOString(),
      sku: payload.data.sku,
      delta: payload.data.delta,
      reason: "webhook-shopee",
      rawPayload: payload
    });
  }

  private async enqueueTikTokOrder(payload: TikTokWebhookPayload): Promise<void> {
    if (!payload.data.order_id || !payload.data.sku || !payload.data.quantity || !payload.data.status) {
      throw new DomainError("Invalid TikTok order payload", 400, "INVALID_TIKTOK_ORDER_PAYLOAD");
    }

    await this.syncService.recordWebhookEvent({
      eventId: payload.event_id,
      platform: PLATFORM.TIKTOK,
      eventType: payload.type,
      sku: payload.data.sku,
      payload
    });

    await this.queueService.enqueueOrderUpsert({
      type: "ORDER_UPSERT",
      eventId: payload.event_id,
      platform: PLATFORM.TIKTOK,
      receivedAt: new Date().toISOString(),
      sku: payload.data.sku,
      orderId: payload.data.order_id,
      quantity: payload.data.quantity,
      status: payload.data.status,
      rawPayload: payload
    });
  }

  private async enqueueTikTokStock(payload: TikTokWebhookPayload): Promise<void> {
    if (!payload.data.sku || payload.data.delta === undefined) {
      throw new DomainError("Invalid TikTok stock payload", 400, "INVALID_TIKTOK_STOCK_PAYLOAD");
    }

    await this.syncService.recordWebhookEvent({
      eventId: payload.event_id,
      platform: PLATFORM.TIKTOK,
      eventType: payload.type,
      sku: payload.data.sku,
      payload
    });

    await this.queueService.enqueueStockAdjustment({
      type: "STOCK_ADJUST",
      eventId: payload.event_id,
      platform: PLATFORM.TIKTOK,
      receivedAt: new Date().toISOString(),
      sku: payload.data.sku,
      delta: payload.data.delta,
      reason: "webhook-tiktok",
      rawPayload: payload
    });
  }
}
