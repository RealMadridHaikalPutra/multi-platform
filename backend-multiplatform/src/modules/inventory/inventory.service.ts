import { DomainError } from "../../shared/errors/domain-error";
import {
  InventoryRepository,
  type InventoryRecord,
  type StockMutationResult
} from "./inventory.repository";

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  async listInventory(): Promise<InventoryRecord[]> {
    return this.repository.findAll();
  }

  async getInventoryBySku(sku: string): Promise<InventoryRecord> {
    const inventory = await this.repository.findBySku(sku);
    if (!inventory) {
      throw new DomainError("Inventory not found", 404, "INVENTORY_NOT_FOUND", { sku });
    }

    return inventory;
  }

  async getQuantityOrZero(sku: string): Promise<number> {
    const inventory = await this.repository.findBySku(sku);
    return inventory?.quantity ?? 0;
  }

  async setQuantity(sku: string, quantity: number): Promise<StockMutationResult> {
    if (quantity < 0) {
      throw new DomainError("Quantity must be non-negative", 400, "INVALID_QUANTITY");
    }

    return this.repository.setQuantityWithLock(sku, quantity);
  }

  async adjustStock(sku: string, delta: number): Promise<StockMutationResult> {
    return this.repository.applyDeltaWithLock(sku, delta);
  }

  async removeInventoryBySku(sku: string): Promise<void> {
    const deleted = await this.repository.deleteBySku(sku);
    if (!deleted) {
      throw new DomainError("Inventory not found", 404, "INVENTORY_NOT_FOUND", { sku });
    }
  }
}
