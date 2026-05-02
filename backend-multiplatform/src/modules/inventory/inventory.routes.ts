import type { FastifyPluginAsync } from "fastify";
import { InventoryController } from "./inventory.controller";
import { InventoryRepository } from "./inventory.repository";
import { InventoryService } from "./inventory.service";

export const inventoryRoutes: FastifyPluginAsync = async (app) => {
  const repository = new InventoryRepository();
  const service = new InventoryService(repository);
  const controller = new InventoryController(service);

  app.get("/inventory", controller.list);
  app.get("/inventory/:sku", controller.get);
  app.put("/inventory/:sku", controller.setQuantity);
  app.patch("/inventory/:sku/adjust", controller.adjust);
  app.delete("/inventory/:sku", controller.remove);
};
