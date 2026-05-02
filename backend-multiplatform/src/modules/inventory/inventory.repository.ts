import { eq, sql } from "drizzle-orm";
import { db } from "../../infrastructure/db/client";
import { inventories } from "../../infrastructure/db/schema";
import { DomainError } from "../../shared/errors/domain-error";

export type InventoryRecord = typeof inventories.$inferSelect;

export interface StockMutationResult {
  sku: string;
  before: number;
  after: number;
}

export class InventoryRepository {
  async findAll(): Promise<InventoryRecord[]> {
    return db.select().from(inventories);
  }

  async findBySku(sku: string): Promise<InventoryRecord | null> {
    const [row] = await db.select().from(inventories).where(eq(inventories.sku, sku)).limit(1);
    return row ?? null;
  }

  async deleteBySku(sku: string): Promise<boolean> {
    const deleted = await db.delete(inventories).where(eq(inventories.sku, sku)).returning({ id: inventories.id });
    return deleted.length > 0;
  }

  async setQuantityWithLock(sku: string, quantity: number): Promise<StockMutationResult> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sku}))`);

      const [current] = await tx.select().from(inventories).where(eq(inventories.sku, sku)).limit(1);
      const before = current?.quantity ?? 0;

      const [updated] = await tx
        .insert(inventories)
        .values({
          sku,
          quantity,
          reserved: current?.reserved ?? 0,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: inventories.sku,
          set: {
            quantity,
            updatedAt: new Date()
          }
        })
        .returning();

      return {
        sku,
        before,
        after: updated.quantity
      };
    });
  }

  async applyDeltaWithLock(sku: string, delta: number): Promise<StockMutationResult> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sku}))`);

      const [current] = await tx.select().from(inventories).where(eq(inventories.sku, sku)).limit(1);
      const before = current?.quantity ?? 0;
      const after = before + delta;

      if (after < 0) {
        throw new DomainError("Stock cannot be negative", 409, "NEGATIVE_STOCK", {
          sku,
          before,
          delta
        });
      }

      const [updated] = await tx
        .insert(inventories)
        .values({
          sku,
          quantity: after,
          reserved: current?.reserved ?? 0,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: inventories.sku,
          set: {
            quantity: after,
            updatedAt: new Date()
          }
        })
        .returning();

      return {
        sku,
        before,
        after: updated.quantity
      };
    });
  }
}
