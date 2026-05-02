import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { env } from "./config/env";
import { ShopeeClient } from "./infrastructure/external/shopee.client";
import { TikTokClient } from "./infrastructure/external/tiktok.client";
import { registerGlobalErrorHandler } from "./shared/errors/http-error-handler";
import { QueueService } from "./modules/queue/queue.service";
import { SyncWorker } from "./modules/queue/sync.worker";
import { WsGateway } from "./modules/ws/ws.gateway";

async function registerSchedulePlugin(app: FastifyInstance): Promise<boolean> {
  // `fastify-schedule` is deprecated; this loader supports both legacy and modern package names.
  try {
    const module = await import("@fastify/schedule");
    const plugin = (module as any).default ?? (module as any).fastifySchedulePlugin ?? module;
    await app.register(plugin as any);
    return true;
  } catch {
    try {
      const module = await import("fastify-schedule");
      const plugin = (module as any).default ?? (module as any).fastifySchedulePlugin ?? module;
      await app.register(plugin as any);
      return true;
    } catch (error) {
      app.log.warn({ err: error }, "schedule plugin unavailable, using setInterval fallback");
      return false;
    }
  }
}

function registerPollingFallbackSchedule(app: FastifyInstance): void {
  const task = new AsyncTask(
    "polling-fallback-5-minutes",
    () => app.syncService.enqueuePollingFallbackJobs(),
    (error: Error) => app.log.error({ err: error }, "scheduled polling failed")
  );

  // Equivalent to cron expression `*/5 * * * *`.
  const job = new SimpleIntervalJob({ minutes: 5 }, task, "sync-polling-5m");

  const scheduler = (app as any).scheduler;
  if (scheduler?.addSimpleIntervalJob) {
    scheduler.addSimpleIntervalJob(job);
    return;
  }

  // Fallback when schedule plugin is not available in runtime.
  const timer = setInterval(() => {
    void app.syncService.enqueuePollingFallbackJobs();
  }, 5 * 60 * 1000);

  app.addHook("onClose", (_instance, done) => {
    clearInterval(timer);
    done();
  });
}

export async function buildApp(): Promise<{ app: FastifyInstance; worker: SyncWorker }> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === "development"
        ? {
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard"
              }
            }
          }
        : {})
    }
  });

  await app.register(cors, {
    origin: true
  });
  await app.register(helmet);
  await app.register(sensible);
  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute"
  });
  await app.register(websocket);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Multi Marketplace Sync Backend",
        description: "API for centralized inventory synchronization (Shopee + TikTok Shop).",
        version: "1.0.0"
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  if (env.USE_DUMMY_DATA) {
    const { dummyRoutes } = await import("./modules/dummy/dummy.routes");

    app.decorate("metrics", {
      trackHttpError: (_route: string, _statusCode: number) => {}
    } as any);

    registerGlobalErrorHandler(app);
    await app.register(dummyRoutes, { prefix: "/api" });

    app.get("/", async () => ({
      service: env.APP_NAME,
      status: "running",
      mode: "dummy"
    }));

    const worker = { close: async () => {} } as SyncWorker;
    return { app, worker };
  }

  const { closeDatabase } = await import("./infrastructure/db/client");
  const { closeRedisConnections, redis } = await import("./infrastructure/redis/redis");

  const [
    { initialSyncRoutes },
    { InitialSyncRepository },
    { InitialSyncService },
    { integrationRoutes },
    { IntegrationRepository },
    { IntegrationService },
    { inventoryRoutes },
    { InventoryRepository },
    { InventoryService },
    { observabilityRoutes },
    { ObservabilityService },
    { orderRoutes },
    { OrderRepository },
    { OrderService },
    { productRoutes },
    { ProductRepository },
    { syncRoutes },
    { SyncService },
    { webhookRoutes }
  ] = await Promise.all([
    import("./modules/initial-sync/initial-sync.routes"),
    import("./modules/initial-sync/initial-sync.repository"),
    import("./modules/initial-sync/initial-sync.service"),
    import("./modules/integration/integration.routes"),
    import("./modules/integration/integration.repository"),
    import("./modules/integration/integration.service"),
    import("./modules/inventory/inventory.routes"),
    import("./modules/inventory/inventory.repository"),
    import("./modules/inventory/inventory.service"),
    import("./modules/observability/observability.routes"),
    import("./modules/observability/observability.service"),
    import("./modules/order/order.routes"),
    import("./modules/order/order.repository"),
    import("./modules/order/order.service"),
    import("./modules/product/product.routes"),
    import("./modules/product/product.repository"),
    import("./modules/sync/sync.routes"),
    import("./modules/sync/sync.service"),
    import("./modules/webhook/webhook.routes")
  ]);

  const queueService = new QueueService(env.QUEUE_NAME);
  queueService.bindEventLogger(app.log);

  const metrics = new ObservabilityService(redis);
  const wsGateway = new WsGateway();
  wsGateway.register(app);

  const integrationRepository = new IntegrationRepository();
  const integrationService = new IntegrationService(integrationRepository);

  const initialSyncRepository = new InitialSyncRepository();

  const inventoryRepository = new InventoryRepository();
  const inventoryService = new InventoryService(inventoryRepository);
  const orderRepository = new OrderRepository();
  const orderService = new OrderService(orderRepository, inventoryService);
  const initialSyncService = new InitialSyncService(
    integrationService,
    inventoryService,
    new ProductRepository(),
    initialSyncRepository
  );
  const syncService = new SyncService(
    queueService,
    inventoryService,
    new ShopeeClient(integrationService),
    new TikTokClient(integrationService),
    metrics,
    redis,
    app.log
  );

  app.decorate("queueService", queueService);
  app.decorate("metrics", metrics);
  app.decorate("wsGateway", wsGateway);
  app.decorate("syncService", syncService);
  app.decorate("integrationService", integrationService);
  app.decorate("initialSyncService", initialSyncService);

  registerGlobalErrorHandler(app);

  await registerSchedulePlugin(app);
  registerPollingFallbackSchedule(app);

  await app.register(productRoutes, { prefix: "/api" });
  await app.register(initialSyncRoutes, { prefix: "/api" });
  await app.register(integrationRoutes, { prefix: "/api" });
  await app.register(inventoryRoutes, { prefix: "/api" });
  await app.register(orderRoutes, { prefix: "/api" });
  await app.register(syncRoutes, { prefix: "/api" });
  await app.register(webhookRoutes, { prefix: "/api" });
  await app.register(observabilityRoutes, { prefix: "/api" });

  app.get("/", async () => ({
    service: env.APP_NAME,
    status: "running",
    websocketClients: app.wsGateway.getClientCount()
  }));

  const worker = new SyncWorker({
    queueName: queueService.queueName,
    redisUrl: env.REDIS_URL,
    inventoryService,
    orderService,
    syncService,
    metrics,
    wsGateway,
    log: app.log
  });

  app.addHook("onClose", async () => {
    await Promise.all([worker.close(), queueService.close(), closeDatabase(), closeRedisConnections()]);
  });

  return { app, worker };
}
