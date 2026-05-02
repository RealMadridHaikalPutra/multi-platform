import { and, eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/client";
import { marketplaceProductLinks, marketplaceProducts } from "../../infrastructure/db/schema";
import type { PlatformName } from "../../shared/types/platform";

export type MarketplaceProductRecord = typeof marketplaceProducts.$inferSelect;
export type MarketplaceProductLinkRecord = typeof marketplaceProductLinks.$inferSelect;

export interface UpsertMarketplaceProductInput {
  platform: PlatformName;
  externalId: string;
  sku: string;
  name: string;
  price?: number;
  stock: number;
  rawPayload?: unknown;
}

export class InitialSyncRepository {
  async upsertMarketplaceProduct(input: UpsertMarketplaceProductInput): Promise<MarketplaceProductRecord> {
    const now = new Date();
    const [row] = await db
      .insert(marketplaceProducts)
      .values({
        platform: input.platform,
        externalId: input.externalId,
        sku: input.sku,
        name: input.name,
        price: input.price ?? null,
        stock: input.stock,
        rawPayload: input.rawPayload ?? null,
        importedAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [marketplaceProducts.platform, marketplaceProducts.externalId],
        set: {
          sku: input.sku,
          name: input.name,
          price: input.price ?? null,
          stock: input.stock,
          rawPayload: input.rawPayload ?? null,
          updatedAt: now
        }
      })
      .returning();

    return row;
  }

  async listMarketplaceProducts(platform?: PlatformName): Promise<MarketplaceProductRecord[]> {
    if (platform) {
      return db.select().from(marketplaceProducts).where(eq(marketplaceProducts.platform, platform));
    }

    return db.select().from(marketplaceProducts);
  }

  async findMarketplaceProduct(platform: PlatformName, externalId: string): Promise<MarketplaceProductRecord | null> {
    const [row] = await db
      .select()
      .from(marketplaceProducts)
      .where(and(eq(marketplaceProducts.platform, platform), eq(marketplaceProducts.externalId, externalId)))
      .limit(1);

    return row ?? null;
  }

  async upsertLink(
    sku: string,
    platform: PlatformName,
    marketplaceProductId: string
  ): Promise<MarketplaceProductLinkRecord> {
    const now = new Date();
    const [row] = await db
      .insert(marketplaceProductLinks)
      .values({
        sku,
        platform,
        marketplaceProductId,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [marketplaceProductLinks.sku, marketplaceProductLinks.platform],
        set: {
          marketplaceProductId,
          updatedAt: now
        }
      })
      .returning();

    return row;
  }

  async listLinkedProductsBySku(sku: string): Promise<Array<{ platform: PlatformName; stock: number }>> {
    return db
      .select({
        platform: marketplaceProductLinks.platform,
        stock: marketplaceProducts.stock
      })
      .from(marketplaceProductLinks)
      .innerJoin(
        marketplaceProducts,
        eq(marketplaceProductLinks.marketplaceProductId, marketplaceProducts.id)
      )
      .where(eq(marketplaceProductLinks.sku, sku));
  }
}
