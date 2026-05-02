import type { Job, JobsOptions } from "bullmq";
import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { env } from "../../config/env";
import type {
  OrderUpsertJob,
  PollMarketplaceJob,
  StockAdjustJob,
  StockSetJob,
  SyncJobPayload
} from "../../shared/types/sync";

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 500
  },
  removeOnComplete: 5_000,
  removeOnFail: 5_000
};

export class QueueService {
  readonly queueName: string;
  readonly connection: IORedis;

  private readonly queue: Queue<SyncJobPayload>;
  private readonly events: QueueEvents;

  constructor(queueName = env.QUEUE_NAME) {
    this.queueName = queueName;
    this.connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null
    });

    this.queue = new Queue<SyncJobPayload>(this.queueName, {
      connection: this.connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS
    });

    this.events = new QueueEvents(this.queueName, {
      connection: this.connection.duplicate()
    });
  }

  async enqueueOrderUpsert(payload: OrderUpsertJob): Promise<Job<SyncJobPayload>> {
    const jobKey = `sku:${payload.sku}`;
    return this.queue.add(payload.type, payload, {
      jobId: `${jobKey}:order:${payload.eventId}`
    });
  }

  async enqueueStockAdjustment(payload: StockAdjustJob): Promise<Job<SyncJobPayload>> {
    const jobKey = `sku:${payload.sku}`;
    return this.queue.add(payload.type, payload, {
      jobId: `${jobKey}:adjust:${payload.eventId}`
    });
  }

  async enqueueStockSet(payload: StockSetJob): Promise<Job<SyncJobPayload>> {
    const jobKey = `sku:${payload.sku}`;
    return this.queue.add(payload.type, payload, {
      jobId: `${jobKey}:set:${payload.eventId}`
    });
  }

  async enqueuePolling(payload: PollMarketplaceJob): Promise<Job<SyncJobPayload>> {
    return this.queue.add(payload.type, payload, {
      jobId: `poll:${payload.marketplace}:${payload.eventId}`
    });
  }

  async getQueueCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0
    };
  }

  bindEventLogger(log: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void }): void {
    this.events.on("completed", ({ jobId }) => {
      log.info({ jobId }, "queue job completed");
    });

    this.events.on("failed", ({ jobId, failedReason }) => {
      log.error({ jobId, failedReason }, "queue job failed");
    });
  }

  async close(): Promise<void> {
    await Promise.all([this.events.close(), this.queue.close(), this.connection.quit()]);
  }
}
