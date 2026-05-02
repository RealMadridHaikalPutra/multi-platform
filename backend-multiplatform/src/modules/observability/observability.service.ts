import { gte } from "drizzle-orm";
import type IORedis from "ioredis";
import { db } from "../../infrastructure/db/client";
import { consistencyLogs, syncJobMetrics } from "../../infrastructure/db/schema";
import type { PlatformName } from "../../shared/types/platform";

const KEY_SYNC_TOTAL = "metrics:sync:total";
const KEY_SYNC_FAILED = "metrics:sync:failed";
const KEY_SYNC_DURATION_SUM = "metrics:sync:duration_sum_ms";
const KEY_SYNC_LATENCY_LIST = "metrics:sync:latencies";
const KEY_CONSISTENCY_TOTAL = "metrics:consistency:total";
const KEY_CONSISTENCY_MISMATCH = "metrics:consistency:mismatch";

export interface SyncMetricInput {
  jobId: string;
  jobType: string;
  platform: PlatformName;
  sku?: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

export interface ConsistencyInput {
  platform: PlatformName;
  sku: string;
  centralQty: number;
  platformQty: number;
  note?: string;
}

export class ObservabilityService {
  constructor(private readonly redis: IORedis) {}

  trackHttpError(route: string, statusCode: number): void {
    void this.redis.hincrby("metrics:http:error_routes", `${statusCode}:${route}`, 1);
    if (statusCode >= 500) {
      void this.redis.incr("metrics:http:5xx");
    }
  }

  async recordSyncMetric(input: SyncMetricInput): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(KEY_SYNC_TOTAL);
    pipeline.incrby(KEY_SYNC_DURATION_SUM, input.durationMs);
    pipeline.lpush(KEY_SYNC_LATENCY_LIST, String(input.durationMs));
    pipeline.ltrim(KEY_SYNC_LATENCY_LIST, 0, 999);
    if (!input.success) {
      pipeline.incr(KEY_SYNC_FAILED);
    }
    await pipeline.exec();

    await db.insert(syncJobMetrics).values({
      jobId: input.jobId,
      jobType: input.jobType,
      platform: input.platform,
      sku: input.sku,
      durationMs: input.durationMs,
      success: input.success,
      errorMessage: input.errorMessage,
      processingDate: new Date()
    });
  }

  async recordConsistency(input: ConsistencyInput): Promise<void> {
    const delta = input.centralQty - input.platformQty;
    const pipeline = this.redis.pipeline();
    pipeline.incr(KEY_CONSISTENCY_TOTAL);
    if (delta !== 0) {
      pipeline.incr(KEY_CONSISTENCY_MISMATCH);
    }
    await pipeline.exec();

    await db.insert(consistencyLogs).values({
      platform: input.platform,
      sku: input.sku,
      centralQty: input.centralQty,
      platformQty: input.platformQty,
      delta,
      note: input.note
    });
  }

  async getMetricsSnapshot(): Promise<{
    totalJobs: number;
    failedJobs: number;
    errorRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    consistencyChecks: number;
    consistencyMismatch: number;
    consistencyMismatchRate: number;
  }> {
    const [
      totalJobsRaw,
      failedJobsRaw,
      durationSumRaw,
      consistencyTotalRaw,
      consistencyMismatchRaw
    ] = await this.redis.mget([
      KEY_SYNC_TOTAL,
      KEY_SYNC_FAILED,
      KEY_SYNC_DURATION_SUM,
      KEY_CONSISTENCY_TOTAL,
      KEY_CONSISTENCY_MISMATCH
    ]);

    const totalJobs = Number(totalJobsRaw ?? 0);
    const failedJobs = Number(failedJobsRaw ?? 0);
    const durationSum = Number(durationSumRaw ?? 0);
    const consistencyChecks = Number(consistencyTotalRaw ?? 0);
    const consistencyMismatch = Number(consistencyMismatchRaw ?? 0);

    const latencies = (await this.redis.lrange(KEY_SYNC_LATENCY_LIST, 0, -1))
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    const p95Index = latencies.length > 0 ? Math.max(Math.ceil(latencies.length * 0.95) - 1, 0) : 0;
    const p95LatencyMs = latencies[p95Index] ?? 0;

    return {
      totalJobs,
      failedJobs,
      errorRate: totalJobs === 0 ? 0 : failedJobs / totalJobs,
      avgLatencyMs: totalJobs === 0 ? 0 : durationSum / totalJobs,
      p95LatencyMs,
      consistencyChecks,
      consistencyMismatch,
      consistencyMismatchRate: consistencyChecks === 0 ? 0 : consistencyMismatch / consistencyChecks
    };
  }

  async getRecentConsistency(limit = 50): Promise<Array<typeof consistencyLogs.$inferSelect>> {
    return db.select().from(consistencyLogs).limit(limit);
  }

  async getLatencySummary(minutes = 60): Promise<{
    sampleSize: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
  }> {
    const since = new Date(Date.now() - minutes * 60_000);
    const rows = await db
      .select({
        durationMs: syncJobMetrics.durationMs
      })
      .from(syncJobMetrics)
      .where(gte(syncJobMetrics.createdAt, since));

    if (rows.length === 0) {
      return {
        sampleSize: 0,
        avgLatencyMs: 0,
        maxLatencyMs: 0
      };
    }

    const sum = rows.reduce((acc, row) => acc + row.durationMs, 0);
    const max = rows.reduce((acc, row) => Math.max(acc, row.durationMs), 0);

    return {
      sampleSize: rows.length,
      avgLatencyMs: sum / rows.length,
      maxLatencyMs: max
    };
  }
}
