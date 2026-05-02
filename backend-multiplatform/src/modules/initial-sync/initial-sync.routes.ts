import type { FastifyPluginAsync } from "fastify";
import { InitialSyncController } from "./initial-sync.controller";

export const initialSyncRoutes: FastifyPluginAsync = async (app) => {
  const controller = new InitialSyncController(app.initialSyncService);

  app.post("/initial-sync/import", controller.import);
  app.get("/initial-sync/marketplace-products", controller.listMarketplaceProducts);
  app.post("/initial-sync/link", controller.link);
  app.post("/initial-sync/normalize", controller.normalize);
};
