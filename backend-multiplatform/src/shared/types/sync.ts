import type { PlatformName } from "./platform";

export type QueueJobType = "ORDER_UPSERT" | "STOCK_ADJUST" | "STOCK_SET" | "POLL_MARKETPLACE";

export interface BaseSyncJob {
  eventId: string;
  platform: PlatformName;
  receivedAt: string;
}

export interface OrderUpsertJob extends BaseSyncJob {
  type: "ORDER_UPSERT";
  sku: string;
  orderId: string;
  quantity: number;
  status: string;
  rawPayload: unknown;
}

export interface StockAdjustJob extends BaseSyncJob {
  type: "STOCK_ADJUST";
  sku: string;
  delta: number;
  reason: string;
  rawPayload: unknown;
}

export interface StockSetJob extends BaseSyncJob {
  type: "STOCK_SET";
  sku: string;
  quantity: number;
  reason: string;
  rawPayload: unknown;
}

export interface PollMarketplaceJob extends BaseSyncJob {
  type: "POLL_MARKETPLACE";
  marketplace: PlatformName;
  cursor?: string;
}

export type SyncJobPayload = OrderUpsertJob | StockAdjustJob | StockSetJob | PollMarketplaceJob;
