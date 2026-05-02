import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform_name", ["SHOPEE", "TIKTOK"]);
export const syncSourceEnum = pgEnum("sync_source", ["WEBHOOK", "POLLING", "MANUAL"]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    price: integer("price").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    skuUnique: uniqueIndex("products_sku_unique").on(table.sku)
  })
);

export const inventories = pgTable(
  "inventories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: text("sku").notNull(),
    quantity: integer("quantity").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    skuUnique: uniqueIndex("inventories_sku_unique").on(table.sku)
  })
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalOrderId: text("external_order_id").notNull(),
    platform: platformEnum("platform").notNull(),
    sku: text("sku").notNull(),
    quantity: integer("quantity").notNull(),
    status: text("status").notNull(),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderUnique: uniqueIndex("orders_external_platform_unique").on(table.externalOrderId, table.platform),
    skuIdx: index("orders_sku_idx").on(table.sku)
  })
);

export const syncEvents = pgTable(
  "sync_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: text("event_id").notNull(),
    platform: platformEnum("platform").notNull(),
    source: syncSourceEnum("source").notNull(),
    eventType: text("event_type").notNull(),
    sku: text("sku"),
    payload: jsonb("payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true })
  },
  (table) => ({
    eventIdUnique: uniqueIndex("sync_events_event_id_unique").on(table.eventId),
    sourceIdx: index("sync_events_source_idx").on(table.source)
  })
);

export const consistencyLogs = pgTable("consistency_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  platform: platformEnum("platform").notNull(),
  sku: text("sku").notNull(),
  centralQty: integer("central_qty").notNull(),
  platformQty: integer("platform_qty").notNull(),
  delta: integer("delta").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const syncJobMetrics = pgTable(
  "sync_job_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: text("job_id").notNull(),
    jobType: text("job_type").notNull(),
    platform: platformEnum("platform").notNull(),
    sku: text("sku"),
    durationMs: integer("duration_ms").notNull(),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processingDate: timestamp("processing_date", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
  },
  (table) => ({
    processingDateIdx: index("sync_job_metrics_processing_date_idx").on(table.processingDate)
  })
);

export const marketplaceIntegrations = pgTable(
  "marketplace_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    platform: platformEnum("platform").notNull(),
    baseUrl: text("base_url"),
    apiKey: text("api_key"),
    apiSecret: text("api_secret"),
    webhookSecret: text("webhook_secret"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    platformUnique: uniqueIndex("marketplace_integrations_platform_unique").on(table.platform)
  })
);

export const marketplaceProducts = pgTable(
  "marketplace_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    price: integer("price"),
    stock: integer("stock").notNull().default(0),
    rawPayload: jsonb("raw_payload"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    marketplaceExternalUnique: uniqueIndex("marketplace_products_platform_external_unique").on(
      table.platform,
      table.externalId
    ),
    marketplaceSkuIdx: index("marketplace_products_platform_sku_idx").on(table.platform, table.sku)
  })
);

export const marketplaceProductLinks = pgTable(
  "marketplace_product_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: text("sku").notNull(),
    platform: platformEnum("platform").notNull(),
    marketplaceProductId: uuid("marketplace_product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    linkUnique: uniqueIndex("marketplace_product_links_sku_platform_unique").on(table.sku, table.platform),
    linkMarketplaceIdx: index("marketplace_product_links_marketplace_idx").on(table.marketplaceProductId)
  })
);
