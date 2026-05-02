import type { FastifyPluginAsync } from "fastify";
import { ProductController } from "./product.controller";
import { ProductRepository } from "./product.repository";
import { ProductService } from "./product.service";

export const productRoutes: FastifyPluginAsync = async (app) => {
  const repository = new ProductRepository();
  const service = new ProductService(repository);
  const controller = new ProductController(service);

  app.get("/products", controller.list);
  app.get("/products/:id", controller.get);
  app.post("/products", controller.create);
  app.put("/products/:id", controller.update);
  app.delete("/products/:id", controller.remove);
};
