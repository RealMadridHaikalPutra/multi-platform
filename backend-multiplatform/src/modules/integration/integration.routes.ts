import type { FastifyPluginAsync } from "fastify";
import { IntegrationController } from "./integration.controller";

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  const controller = new IntegrationController(app.integrationService);

  app.get("/integrations", controller.list);
  app.put("/integrations/:platform", controller.upsert);
};
