import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/client";
import { products } from "../../infrastructure/db/schema";

export type ProductRecord = typeof products.$inferSelect;
export type CreateProductInput = Omit<typeof products.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type UpdateProductInput = Partial<CreateProductInput>;

export class ProductRepository {
  async findAll(): Promise<ProductRecord[]> {
    return db.select().from(products);
  }

  async findById(id: string): Promise<ProductRecord | null> {
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return row ?? null;
  }

  async findBySku(sku: string): Promise<ProductRecord | null> {
    const [row] = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
    return row ?? null;
  }

  async create(input: CreateProductInput): Promise<ProductRecord> {
    const [row] = await db.insert(products).values(input).returning();
    return row;
  }

  async update(id: string, input: UpdateProductInput): Promise<ProductRecord | null> {
    const [row] = await db
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    return row ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    return deleted.length > 0;
  }
}
