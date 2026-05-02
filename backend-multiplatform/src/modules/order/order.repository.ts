import { and, eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/client";
import { orders } from "../../infrastructure/db/schema";
import type { PlatformName } from "../../shared/types/platform";

export type OrderRecord = typeof orders.$inferSelect;

export interface UpsertOrderInput {
  externalOrderId: string;
  platform: PlatformName;
  sku: string;
  quantity: number;
  status: string;
  rawPayload?: unknown;
}

export class OrderRepository {
  async findAll(): Promise<OrderRecord[]> {
    return db.select().from(orders);
  }

  async findById(id: string): Promise<OrderRecord | null> {
    const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return row ?? null;
  }

  async findByExternal(platform: PlatformName, externalOrderId: string): Promise<OrderRecord | null> {
    const [row] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.platform, platform), eq(orders.externalOrderId, externalOrderId)))
      .limit(1);
    return row ?? null;
  }

  async upsert(input: UpsertOrderInput): Promise<OrderRecord> {
    const [row] = await db
      .insert(orders)
      .values({
        externalOrderId: input.externalOrderId,
        platform: input.platform,
        sku: input.sku,
        quantity: input.quantity,
        status: input.status,
        rawPayload: input.rawPayload,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [orders.externalOrderId, orders.platform],
        set: {
          sku: input.sku,
          quantity: input.quantity,
          status: input.status,
          rawPayload: input.rawPayload,
          updatedAt: new Date()
        }
      })
      .returning();

    return row;
  }

  async deleteById(id: string): Promise<boolean> {
    const deleted = await db.delete(orders).where(eq(orders.id, id)).returning({ id: orders.id });
    return deleted.length > 0;
  }
}
