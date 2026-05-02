import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { FastifyBaseLogger } from "fastify";
import { DistributedLockService } from "../../infrastructure/redis/distributed-lock";
import type { ObservabilityService } from "../observability/observability.service";
import type { OrderService } from "../order/order.service";
import type { SyncService } from "../sync/sync.service";
import type { WsGateway } from "../ws/ws.gateway";
import type { InventoryService } from "../inventory/inventory.service";
import type { SyncJobPayload } from "../../shared/types/sync";

interface SyncWorkerDeps {
  queueName: string;
  redisUrl: string;
  orderService: OrderService;
  inventoryService: InventoryService;
  syncService: SyncService;
  metrics: ObservabilityService;
  wsGateway: WsGateway;
  log: FastifyBaseLogger;
}

export class SyncWorker {
  private readonly workerConnection: IORedis;
  private readonly lockService: DistributedLockService;
  private readonly worker: Worker<SyncJobPayload>;

  constructor(private readonly deps: SyncWorkerDeps) {
    this.workerConnection = new IORedis(deps.redisUrl, { maxRetriesPerRequest: null });
    this.lockService = new DistributedLockService(this.workerConnection);

    this.worker = new Worker<SyncJobPayload>(deps.queueName, this.processJob, {
      connection: this.workerConnection,
      concurrency: 20
    });

    this.bindWorkerEvents();
  }

  private bindWorkerEvents(): void {
    this.worker.on("completed", (job) => {
      this.deps.log.info({ jobId: job.id, name: job.name }, "worker completed job");
    });

    this.worker.on("failed", (job, error) => {
      this.deps.log.error(
        {
          jobId: job?.id,
          name: job?.name,
          err: error
        },
        "worker failed job"
      );
    });
  }

  private readonly processJob = async (job: Job<SyncJobPayload>): Promise<void> => {
    const start = Date.now();
    const payload = job.data;
    const lockKey = this.getLockKey(payload);

    try {
      await this.lockService.withLock(lockKey, 30_000, async () => {
        switch (payload.type) {
          case "ORDER_UPSERT": {
            const result = await this.deps.orderService.processOrderUpsert({
              externalOrderId: payload.orderId,
              platform: payload.platform,
              sku: payload.sku,
              quantity: payload.quantity,
              status: payload.status,
              rawPayload: payload.rawPayload
            });

            this.deps.wsGateway.publish("order.updated", {
              orderId: payload.orderId,
              platform: payload.platform,
              sku: payload.sku,
              status: payload.status,
              stockDeltaApplied: result.stockDeltaApplied
            });
            break;
          }

          case "STOCK_ADJUST": {
            const stock = await this.deps.inventoryService.adjustStock(payload.sku, payload.delta);

            this.deps.wsGateway.publish("stock.updated", {
              sku: payload.sku,
              platform: payload.platform,
              before: stock.before,
              after: stock.after,
              reason: payload.reason
            });
            break;
          }

          case "STOCK_SET": {
            const stock = await this.deps.inventoryService.setQuantity(payload.sku, payload.quantity);
            this.deps.wsGateway.publish("stock.updated", {
              sku: payload.sku,
              platform: payload.platform,
              before: stock.before,
              after: stock.after,
              reason: payload.reason
            });
            break;
          }

          case "POLL_MARKETPLACE": {
            const result = await this.deps.syncService.pollMarketplace(payload.marketplace, payload.cursor);
            this.deps.wsGateway.publish("sync.polled", result);
            break;
          }

          default:
            throw new Error(`unsupported job type=${(payload as { type: string }).type}`);
        }
      });

      await this.deps.syncService.markEventProcessed(payload.eventId);

      const durationMs = Date.now() - start;
      await this.deps.metrics.recordSyncMetric({
        jobId: String(job.id ?? "unknown"),
        jobType: payload.type,
        platform: payload.platform,
        sku: "sku" in payload ? payload.sku : undefined,
        durationMs,
        success: true
      });

      this.deps.log.info(
        {
          jobId: job.id,
          type: payload.type,
          durationMs
        },
        "sync job processed"
      );
    } catch (error: any) {
      const durationMs = Date.now() - start;
      await this.deps.metrics.recordSyncMetric({
        jobId: String(job.id ?? "unknown"),
        jobType: payload.type,
        platform: payload.platform,
        sku: "sku" in payload ? payload.sku : undefined,
        durationMs,
        success: false,
        errorMessage: error?.message ?? "unknown error"
      });
      throw error;
    }
  };

  private getLockKey(payload: SyncJobPayload): string {
    if ("sku" in payload) {
      return `sync:lock:sku:${payload.sku}`;
    }

    return `sync:lock:poll:${payload.marketplace}`;
  }

  async close(): Promise<void> {
    await Promise.all([this.worker.close(), this.workerConnection.quit()]);
  }
}
