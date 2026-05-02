import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { DomainError } from "../../shared/errors/domain-error";
import dummyData from "./dummy.data.json";

type OrderPlatform = "SHOPEE" | "TIKTOK";
type IntegrationPlatform = "SHOPEE" | "TIKTOK";

interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InventoryRecord {
  id: string;
  sku: string;
  quantity: number;
  reserved: number;
  updatedAt: string;
}

interface OrderRecord {
  id: string;
  externalOrderId: string;
  platform: OrderPlatform;
  sku: string;
  quantity: number;
  status: string;
  rawPayload: unknown;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationRecord {
  platform: IntegrationPlatform;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  createdAt: string;
  updatedAt: string;
}

interface MarketplaceProductRecord {
  id: string;
  platform: IntegrationPlatform;
  externalId: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  rawPayload: unknown;
  importedAt: string;
  updatedAt: string;
}

interface MarketplaceProductLinkRecord {
  id: string;
  sku: string;
  platform: IntegrationPlatform;
  marketplaceProductId: string;
  createdAt: string;
  updatedAt: string;
}

const store = {
  products: dummyData.products.map((item) => ({ ...item })) as ProductRecord[],
  inventory: dummyData.inventory.map((item) => ({ ...item })) as InventoryRecord[],
  orders: dummyData.orders.map((item) => ({ ...item })) as OrderRecord[],
  integrations: [
    {
      platform: "SHOPEE",
      baseUrl: "https://partner.shopeemobile.com",
      apiKey: "",
      apiSecret: "",
      webhookSecret: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      platform: "TIKTOK",
      baseUrl: "https://open-api.tiktokglobalshop.com",
      apiKey: "",
      apiSecret: "",
      webhookSecret: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ] as IntegrationRecord[],
  marketplaceProducts: [] as MarketplaceProductRecord[],
  marketplaceProductLinks: [] as MarketplaceProductLinkRecord[]
};

const nowIso = (): string => new Date().toISOString();

const ProductBodySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().nonnegative(),
  isActive: z.boolean().optional()
});

const ProductUpdateSchema = ProductBodySchema.partial();

const InventorySetBodySchema = z.object({
  quantity: z.number().int().nonnegative(),
  reason: z.string().min(1).optional()
});

const InventoryAdjustBodySchema = z.object({
  delta: z.number().int(),
  reason: z.string().min(1).optional()
});

const OrderBodySchema = z.object({
  platform: z.enum(["SHOPEE", "TIKTOK"]),
  externalOrderId: z.string().min(1).optional(),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  status: z.string().min(1)
});

const IntegrationParamsSchema = z.object({
  platform: z.enum(["SHOPEE", "TIKTOK"])
});

const IntegrationBodySchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  webhookSecret: z.string().min(1)
});

const InitialImportSchema = z.object({
  platforms: z.array(z.enum(["SHOPEE", "TIKTOK"])).optional()
});

const InitialLinkSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().nonnegative().default(0),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  links: z.array(
    z.object({
      platform: z.enum(["SHOPEE", "TIKTOK"]),
      externalId: z.string().min(1)
    })
  ).min(1)
});

const InitialNormalizeSchema = z.object({
  sku: z.string().min(1),
  stockSource: z.enum(["SHOPEE", "TIKTOK", "MANUAL"]),
  manualStock: z.number().int().nonnegative().optional()
});

const getOrderPlatformLabel = (platform: OrderPlatform): OrderPlatform => platform;

const findProduct = (id: string): ProductRecord => {
  const product = store.products.find((item) => item.id === id);
  if (!product) {
    throw new DomainError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  return product;
};

const findInventory = (sku: string): InventoryRecord => {
  const inventory = store.inventory.find((item) => item.sku === sku);
  if (!inventory) {
    throw new DomainError("Inventory not found", 404, "INVENTORY_NOT_FOUND", { sku });
  }

  return inventory;
};

const findOrderById = (id: string): OrderRecord => {
  const order = store.orders.find((item) => item.id === id);
  if (!order) {
    throw new DomainError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  return order;
};

const findOrderByExternal = (platform: OrderPlatform, externalOrderId: string): OrderRecord | undefined => {
  return store.orders.find(
    (order) => order.externalOrderId === externalOrderId && order.platform === platform
  );
};

const findIntegration = (platform: IntegrationPlatform): IntegrationRecord | undefined => {
  return store.integrations.find((item) => item.platform === platform);
};

const withIntegrationSource = (record: IntegrationRecord) => ({
  platform: record.platform,
  baseUrl: record.baseUrl,
  apiKey: record.apiKey,
  apiSecret: record.apiSecret,
  webhookSecret: record.webhookSecret,
  updatedAt: record.updatedAt,
  source: "database"
});

const upsertMarketplaceProduct = (record: MarketplaceProductRecord): MarketplaceProductRecord => {
  const existing = store.marketplaceProducts.find(
    (item) => item.platform === record.platform && item.externalId === record.externalId
  );

  if (existing) {
    Object.assign(existing, {
      sku: record.sku,
      name: record.name,
      price: record.price,
      stock: record.stock,
      rawPayload: record.rawPayload,
      updatedAt: nowIso()
    });
    return existing;
  }

  store.marketplaceProducts.push(record);
  return record;
};

const upsertMarketplaceProductLink = (
  sku: string,
  platform: IntegrationPlatform,
  marketplaceProductId: string
): MarketplaceProductLinkRecord => {
  const existing = store.marketplaceProductLinks.find(
    (item) => item.sku === sku && item.platform === platform
  );

  if (existing) {
    existing.marketplaceProductId = marketplaceProductId;
    existing.updatedAt = nowIso();
    return existing;
  }

  const record: MarketplaceProductLinkRecord = {
    id: randomUUID(),
    sku,
    platform,
    marketplaceProductId,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  store.marketplaceProductLinks.push(record);
  return record;
};

const findMarketplaceProduct = (platform: IntegrationPlatform, externalId: string): MarketplaceProductRecord | undefined => {
  return store.marketplaceProducts.find(
    (item) => item.platform === platform && item.externalId === externalId
  );
};

const listMarketplaceProducts = (platform?: IntegrationPlatform): MarketplaceProductRecord[] => {
  if (platform) {
    return store.marketplaceProducts.filter((item) => item.platform === platform);
  }

  return store.marketplaceProducts;
};

const listLinkedMarketplaceProductsBySku = (sku: string): MarketplaceProductRecord[] => {
  const links = store.marketplaceProductLinks.filter((item) => item.sku === sku);
  return links
    .map((link) => store.marketplaceProducts.find((product) => product.id === link.marketplaceProductId))
    .filter((item): item is MarketplaceProductRecord => Boolean(item));
};

const ensureInventory = (sku: string, quantity: number): void => {
  const existing = store.inventory.find((item) => item.sku === sku);
  if (existing) {
    existing.quantity = quantity;
    existing.updatedAt = nowIso();
    return;
  }

  store.inventory.push({
    id: randomUUID(),
    sku,
    quantity,
    reserved: 0,
    updatedAt: nowIso()
  });
};

export const dummyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/products", async () => store.products);

  app.get("/products/:id", async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    return findProduct(params.id);
  });

  app.post("/products", async (request, reply) => {
    const body = ProductBodySchema.parse(request.body);

    const existing = store.products.find((item) => item.sku === body.sku);
    if (existing) {
      throw new DomainError("SKU already exists", 409, "SKU_ALREADY_EXISTS", { sku: body.sku });
    }

    const createdAt = nowIso();
    const product: ProductRecord = {
      id: randomUUID(),
      sku: body.sku,
      name: body.name,
      description: body.description ?? null,
      price: body.price,
      isActive: body.isActive ?? true,
      createdAt,
      updatedAt: createdAt
    };

    store.products.push(product);
    reply.status(201).send(product);
  });

  app.put("/products/:id", async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = ProductUpdateSchema.parse(request.body);

    const product = findProduct(params.id);
    if (body.sku && body.sku !== product.sku) {
      const existing = store.products.find((item) => item.sku === body.sku && item.id !== product.id);
      if (existing) {
        throw new DomainError("SKU already exists", 409, "SKU_ALREADY_EXISTS", { sku: body.sku });
      }
    }

    Object.assign(product, {
      sku: body.sku ?? product.sku,
      name: body.name ?? product.name,
      description: body.description ?? product.description,
      price: body.price ?? product.price,
      isActive: body.isActive ?? product.isActive,
      updatedAt: nowIso()
    });

    return product;
  });

  app.delete("/products/:id", async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const before = store.products.length;
    store.products = store.products.filter((item) => item.id !== params.id);

    if (before === store.products.length) {
      throw new DomainError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    reply.status(204).send();
  });

  app.get("/inventory", async () => store.inventory);

  app.get("/inventory/:sku", async (request) => {
    const params = z.object({ sku: z.string().min(1) }).parse(request.params);
    return findInventory(params.sku);
  });

  app.put("/inventory/:sku", async (request) => {
    const params = z.object({ sku: z.string().min(1) }).parse(request.params);
    const body = InventorySetBodySchema.parse(request.body);

    const inventory = store.inventory.find((item) => item.sku === params.sku);
    const before = inventory?.quantity ?? 0;
    const updatedAt = nowIso();

    if (inventory) {
      inventory.quantity = body.quantity;
      inventory.updatedAt = updatedAt;
    } else {
      store.inventory.push({
        id: randomUUID(),
        sku: params.sku,
        quantity: body.quantity,
        reserved: 0,
        updatedAt
      });
    }

    return {
      sku: params.sku,
      before,
      after: body.quantity
    };
  });

  app.patch("/inventory/:sku/adjust", async (request) => {
    const params = z.object({ sku: z.string().min(1) }).parse(request.params);
    const body = InventoryAdjustBodySchema.parse(request.body);

    const inventory = store.inventory.find((item) => item.sku === params.sku);
    const before = inventory?.quantity ?? 0;
    const after = before + body.delta;

    if (after < 0) {
      throw new DomainError("Stock cannot be negative", 409, "NEGATIVE_STOCK", {
        sku: params.sku,
        before,
        delta: body.delta
      });
    }

    if (inventory) {
      inventory.quantity = after;
      inventory.updatedAt = nowIso();
    } else {
      store.inventory.push({
        id: randomUUID(),
        sku: params.sku,
        quantity: after,
        reserved: 0,
        updatedAt: nowIso()
      });
    }

    return {
      sku: params.sku,
      before,
      after
    };
  });

  app.delete("/inventory/:sku", async (request, reply) => {
    const params = z.object({ sku: z.string().min(1) }).parse(request.params);
    const before = store.inventory.length;
    store.inventory = store.inventory.filter((item) => item.sku !== params.sku);

    if (before === store.inventory.length) {
      throw new DomainError("Inventory not found", 404, "INVENTORY_NOT_FOUND", { sku: params.sku });
    }

    reply.status(204).send();
  });

  app.get("/orders", async () => store.orders);

  app.get("/orders/:id", async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    return findOrderById(params.id);
  });

  app.post("/orders", async (request, reply) => {
    const body = OrderBodySchema.parse(request.body);
    const platform = getOrderPlatformLabel(body.platform);
    const externalOrderId = body.externalOrderId ?? `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
    const existing = findOrderByExternal(platform, externalOrderId);

    if (existing) {
      existing.sku = body.sku;
      existing.quantity = body.quantity;
      existing.status = body.status;
      existing.updatedAt = nowIso();
    } else {
      store.orders.push({
        id: randomUUID(),
        externalOrderId,
        platform,
        sku: body.sku,
        quantity: body.quantity,
        status: body.status,
        rawPayload: body,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    }

    reply.status(202).send({
      accepted: true,
      eventId: randomUUID(),
      externalOrderId
    });
  });

  app.put("/orders/external/:externalOrderId", async (request, reply) => {
    const params = z.object({ externalOrderId: z.string().min(1) }).parse(request.params);
    const body = OrderBodySchema.parse(request.body);
    const platform = getOrderPlatformLabel(body.platform);
    const existing = findOrderByExternal(platform, params.externalOrderId);

    if (existing) {
      existing.sku = body.sku;
      existing.quantity = body.quantity;
      existing.status = body.status;
      existing.updatedAt = nowIso();
    } else {
      store.orders.push({
        id: randomUUID(),
        externalOrderId: params.externalOrderId,
        platform,
        sku: body.sku,
        quantity: body.quantity,
        status: body.status,
        rawPayload: body,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    }

    reply.status(202).send({
      accepted: true,
      eventId: randomUUID(),
      externalOrderId: params.externalOrderId
    });
  });

  app.delete("/orders/:id", async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const before = store.orders.length;
    store.orders = store.orders.filter((item) => item.id !== params.id);

    if (before === store.orders.length) {
      throw new DomainError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    reply.status(204).send();
  });

  app.get("/integrations", async () => store.integrations.map((item) => withIntegrationSource(item)));

  app.put("/integrations/:platform", async (request) => {
    const params = IntegrationParamsSchema.parse(request.params);
    const body = IntegrationBodySchema.parse(request.body);
    const existing = findIntegration(params.platform);

    if (existing) {
      existing.baseUrl = body.baseUrl;
      existing.apiKey = body.apiKey;
      existing.apiSecret = body.apiSecret;
      existing.webhookSecret = body.webhookSecret;
      existing.updatedAt = nowIso();
      return withIntegrationSource(existing);
    }

    const createdAt = nowIso();
    const record: IntegrationRecord = {
      platform: params.platform,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,
      webhookSecret: body.webhookSecret,
      createdAt,
      updatedAt: createdAt
    };

    store.integrations.push(record);
    return withIntegrationSource(record);
  });

  app.post("/initial-sync/import", async (request, reply) => {
    const body = InitialImportSchema.parse(request.body ?? {});
    const targets = body.platforms?.length ? body.platforms : ["SHOPEE", "TIKTOK"];

    const results = targets.map((platform) => {
      const importedAt = nowIso();
      const items = store.products.map((product) => {
        const inventory = store.inventory.find((item) => item.sku === product.sku);
        const record: MarketplaceProductRecord = {
          id: randomUUID(),
          platform,
          externalId: `${platform}-${product.sku}`,
          sku: product.sku,
          name: product.name,
          price: product.price,
          stock: inventory?.quantity ?? 0,
          rawPayload: { product, inventory },
          importedAt,
          updatedAt: importedAt
        };

        upsertMarketplaceProduct(record);
        return record;
      });

      return {
        platform,
        importedCount: items.length
      };
    });

    reply.status(202).send({
      accepted: true,
      results
    });
  });

  app.get("/initial-sync/marketplace-products", async (request) => {
    const query = z
      .object({ platform: z.enum(["SHOPEE", "TIKTOK"]).optional() })
      .parse(request.query ?? {});
    return listMarketplaceProducts(query.platform);
  });

  app.post("/initial-sync/link", async (request) => {
    const body = InitialLinkSchema.parse(request.body);
    let product = store.products.find((item) => item.sku === body.sku);

    if (!product) {
      const createdAt = nowIso();
      product = {
        id: randomUUID(),
        sku: body.sku,
        name: body.name,
        description: body.description ?? null,
        price: body.price,
        isActive: body.isActive ?? true,
        createdAt,
        updatedAt: createdAt
      };
      store.products.push(product);
    } else {
      product.name = body.name;
      product.description = body.description ?? product.description;
      product.price = body.price;
      product.isActive = body.isActive ?? product.isActive;
      product.updatedAt = nowIso();
    }

    body.links.forEach((link) => {
      const record = findMarketplaceProduct(link.platform, link.externalId);
      if (!record) {
        throw new DomainError("Marketplace product not found", 404, "MARKETPLACE_PRODUCT_NOT_FOUND", {
          platform: link.platform,
          externalId: link.externalId
        });
      }

      upsertMarketplaceProductLink(body.sku, link.platform, record.id);
    });

    return {
      sku: body.sku,
      linked: body.links
    };
  });

  app.post("/initial-sync/normalize", async (request) => {
    const body = InitialNormalizeSchema.parse(request.body);
    const product = store.products.find((item) => item.sku === body.sku);
    if (!product) {
      throw new DomainError("Product not found", 404, "PRODUCT_NOT_FOUND", { sku: body.sku });
    }

    const before = store.inventory.find((item) => item.sku === body.sku)?.quantity ?? 0;
    let targetStock = 0;

    if (body.stockSource === "MANUAL") {
      if (body.manualStock === undefined) {
        throw new DomainError("Manual stock required", 400, "MANUAL_STOCK_REQUIRED");
      }
      targetStock = body.manualStock;
    } else {
      const linked = listLinkedMarketplaceProductsBySku(body.sku);
      const source = linked.find((item) => item.platform === body.stockSource);
      if (!source) {
        throw new DomainError("Linked marketplace product not found", 404, "LINK_NOT_FOUND", {
          sku: body.sku,
          platform: body.stockSource
        });
      }
      targetStock = source.stock;
    }

    ensureInventory(body.sku, targetStock);

    return {
      sku: body.sku,
      source: body.stockSource,
      before,
      after: targetStock
    };
  });

  app.get("/observability/health", async () => ({
    status: "ok",
    uptimeSec: process.uptime(),
    queue: {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    }
  }));

  app.get("/observability/metrics", async () => ({
    totalJobs: store.orders.length,
    failedJobs: 0,
    errorRate: 0,
    avgLatencyMs: 120,
    p95LatencyMs: 180,
    consistencyChecks: store.inventory.length,
    consistencyMismatch: 0,
    consistencyMismatchRate: 0
  }));

  app.get("/observability/consistency", async () => []);

  app.get("/observability/latency", async () => ({
    sampleSize: 0,
    avgLatencyMs: 0,
    maxLatencyMs: 0
  }));
};
