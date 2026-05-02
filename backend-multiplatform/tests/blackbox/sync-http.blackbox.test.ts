import { describe, expect, it } from "vitest";

const BASE_URL = process.env.TARGET_URL ?? "http://127.0.0.1:3000";

describe("Black-box API checks", () => {
  it("returns health and queue snapshot", async () => {
    const response = await fetch(`${BASE_URL}/api/observability/health`);
    expect(response.status).toBe(200);

    const payload = await response.json() as { status: string; queue: Record<string, number> };
    expect(payload.status).toBe("ok");
    expect(typeof payload.queue.waiting).toBe("number");
  });

  it("accepts polling trigger as async command", async () => {
    const response = await fetch(`${BASE_URL}/api/sync/poll/trigger`, {
      method: "POST"
    });

    expect(response.status).toBe(202);
    const payload = await response.json() as { accepted: boolean };
    expect(payload.accepted).toBe(true);
  });

  it("exposes metrics endpoint for error-rate and latency observations", async () => {
    const response = await fetch(`${BASE_URL}/api/observability/metrics`);
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      totalJobs: number;
      errorRate: number;
      avgLatencyMs: number;
    };

    expect(typeof payload.totalJobs).toBe("number");
    expect(typeof payload.errorRate).toBe("number");
    expect(typeof payload.avgLatencyMs).toBe("number");
  });
});
