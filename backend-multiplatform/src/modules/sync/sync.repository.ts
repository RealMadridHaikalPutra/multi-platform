import { and, eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/client";
import { syncEvents } from "../../infrastructure/db/schema";
import type { PlatformName } from "../../shared/types/platform";

type SyncSource = "WEBHOOK" | "POLLING" | "MANUAL";

export interface RecordSyncEventInput {
  eventId: string;
  platform: PlatformName;
  source: SyncSource;
  eventType: string;
  sku?: string;
  payload: unknown;
}

export class SyncRepository {
  async recordEvent(input: RecordSyncEventInput): Promise<void> {
    await db
      .insert(syncEvents)
      .values({
        eventId: input.eventId,
        platform: input.platform,
        source: input.source,
        eventType: input.eventType,
        sku: input.sku,
        payload: input.payload,
        processed: false
      })
      .onConflictDoNothing({
        target: syncEvents.eventId
      });
  }

  async markProcessed(eventId: string): Promise<void> {
    await db
      .update(syncEvents)
      .set({
        processed: true,
        processedAt: new Date()
      })
      .where(eq(syncEvents.eventId, eventId));
  }

  async isProcessed(eventId: string): Promise<boolean> {
    const [row] = await db
      .select({
        processed: syncEvents.processed
      })
      .from(syncEvents)
      .where(eq(syncEvents.eventId, eventId))
      .limit(1);

    return row?.processed ?? false;
  }

  async getUnprocessed(limit = 100): Promise<Array<typeof syncEvents.$inferSelect>> {
    return db.select().from(syncEvents).where(eq(syncEvents.processed, false)).limit(limit);
  }

  async findByEventId(eventId: string): Promise<typeof syncEvents.$inferSelect | null> {
    const [row] = await db.select().from(syncEvents).where(eq(syncEvents.eventId, eventId)).limit(1);
    return row ?? null;
  }

  async markAllProcessedBySku(eventId: string, sku: string): Promise<void> {
    await db
      .update(syncEvents)
      .set({
        processed: true,
        processedAt: new Date()
      })
      .where(and(eq(syncEvents.eventId, eventId), eq(syncEvents.sku, sku)));
  }
}
