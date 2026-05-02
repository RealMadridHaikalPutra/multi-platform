import type { FastifyBaseLogger } from "fastify";
import type { QueueService } from "../../modules/queue/queue.service";
import type { SyncService } from "../../modules/sync/sync.service";
import type { WsGateway } from "../../modules/ws/ws.gateway";
import type { ObservabilityService } from "../../modules/observability/observability.service";
import type { IntegrationService } from "../../modules/integration/integration.service";
import type { InitialSyncService } from "../../modules/initial-sync/initial-sync.service";

declare module "fastify" {
  interface FastifyInstance {
    queueService: QueueService;
    syncService: SyncService;
    wsGateway: WsGateway;
    metrics: ObservabilityService;
    integrationService: IntegrationService;
    initialSyncService: InitialSyncService;
    log: FastifyBaseLogger;
  }
}
