import type { FastifyPluginAsync } from "fastify";
import { InventoryRepository } from "../inventory/inventory.repository";
import { InventoryService } from "../inventory/inventory.service";
import { OrderController } from "./order.controller";
import { OrderRepository } from "./order.repository";
import { OrderService } from "./order.service";

export const orderRoutes: FastifyPluginAsync = async (app) => {
  const inventoryRepository = new InventoryRepository();
  const inventoryService = new InventoryService(inventoryRepository);
  const orderRepository = new OrderRepository();
  const orderService = new OrderService(orderRepository, inventoryService);
  const orderController = new OrderController(orderService);

  app.get("/orders", orderController.list);
  app.get("/orders/:id", orderController.get);
  app.post("/orders", orderController.create);
  app.put("/orders/external/:externalOrderId", orderController.upsertByExternal);
  app.delete("/orders/:id", orderController.remove);
};
