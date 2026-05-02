import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/client";
import { marketplaceIntegrations } from "../../infrastructure/db/schema";
import type { PlatformName } from "../../shared/types/platform";

export type IntegrationRecord = typeof marketplaceIntegrations.$inferSelect;

export interface UpsertIntegrationInput {
  platform: PlatformName;
  baseUrl?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  webhookSecret?: string | null;
}

export class IntegrationRepository {
  async findAll(): Promise<IntegrationRecord[]> {
    return db.select().from(marketplaceIntegrations);
  }

  async findByPlatform(platform: PlatformName): Promise<IntegrationRecord | null> {
    const [row] = await db
      .select()
      .from(marketplaceIntegrations)
      .where(eq(marketplaceIntegrations.platform, platform))
      .limit(1);

    return row ?? null;
  }

  async upsert(input: UpsertIntegrationInput): Promise<IntegrationRecord> {
    const [row] = await db
      .insert(marketplaceIntegrations)
      .values({
        platform: input.platform,
        baseUrl: input.baseUrl ?? null,
        apiKey: input.apiKey ?? null,
        apiSecret: input.apiSecret ?? null,
        webhookSecret: input.webhookSecret ?? null,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: marketplaceIntegrations.platform,
        set: {
          baseUrl: input.baseUrl ?? null,
          apiKey: input.apiKey ?? null,
          apiSecret: input.apiSecret ?? null,
          webhookSecret: input.webhookSecret ?? null,
          updatedAt: new Date()
        }
      })
      .returning();

    return row;
  }
}
