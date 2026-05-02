import { DomainError } from "../../shared/errors/domain-error";
import type { PlatformName } from "../../shared/types/platform";
import type { InventoryService } from "../inventory/inventory.service";
import {
  OrderRepository,
  type OrderRecord,
  type UpsertOrderInput
} from "./order.repository";

const ACTIVE_ORDER_STATUS = new Set(["PENDING", "PAID", "CONFIRMED", "READY_TO_SHIP", "PROCESSING"]);
const REVERT_ORDER_STATUS = new Set(["CANCELLED", "RETURNED", "REFUNDED"]);

export interface ProcessedOrderResult {
  order: OrderRecord;
  stockDeltaApplied: number;
}

export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly inventoryService: InventoryService
  ) {}

  async listOrders(): Promise<OrderRecord[]> {
    return this.repository.findAll();
  }

  async getOrderById(id: string): Promise<OrderRecord> {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new DomainError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    return order;
  }

  async processOrderUpsert(input: UpsertOrderInput): Promise<ProcessedOrderResult> {
    const current = await this.repository.findByExternal(input.platform, input.externalOrderId);
    const normalizedStatus = input.status.toUpperCase();

    let stockDelta = 0;
    if (!current && ACTIVE_ORDER_STATUS.has(normalizedStatus)) {
      stockDelta = -input.quantity;
    }

    if (current) {
      const wasActive = ACTIVE_ORDER_STATUS.has(current.status.toUpperCase());
      const isActive = ACTIVE_ORDER_STATUS.has(normalizedStatus);
      const isReverted = REVERT_ORDER_STATUS.has(normalizedStatus);

      if (!wasActive && isActive) {
        stockDelta = -input.quantity;
      } else if (wasActive && isReverted) {
        stockDelta = input.quantity;
      }
    }

    const order = await this.repository.upsert(input);

    if (stockDelta !== 0) {
      await this.inventoryService.adjustStock(input.sku, stockDelta);
    }

    return {
      order,
      stockDeltaApplied: stockDelta
    };
  }

  async deleteOrder(id: string): Promise<void> {
    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw new DomainError("Order not found", 404, "ORDER_NOT_FOUND");
    }
  }

  async getOrderByExternal(platform: PlatformName, externalOrderId: string): Promise<OrderRecord | null> {
    return this.repository.findByExternal(platform, externalOrderId);
  }
}
