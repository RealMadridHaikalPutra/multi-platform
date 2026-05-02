import autocannon from "autocannon";

const baseUrl = process.env.TARGET_URL ?? "http://127.0.0.1:3000";

function runHealthProbe(): Promise<void> {
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: `${baseUrl}/api/observability/health`,
        connections: 50,
        duration: 20,
        pipelining: 1
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );

    autocannon.track(instance, {
      renderProgressBar: true,
      renderLatencyTable: true,
      renderResultsTable: true
    });
  });
}

function runBenchmarkTrigger(): Promise<void> {
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: `${baseUrl}/api/observability/benchmark/sync`,
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          platform: "SHOPEE",
          skuPrefix: "PERF-SKU",
          skuCount: 100,
          jobsPerSku: 20,
          delta: -1
        }),
        connections: 10,
        amount: 200
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );

    autocannon.track(instance, {
      renderProgressBar: true,
      renderLatencyTable: true,
      renderResultsTable: true
    });
  });
}

async function main(): Promise<void> {
  console.log(`[perf] target = ${baseUrl}`);
  console.log("[perf] Step 1: baseline health endpoint load test");
  await runHealthProbe();

  console.log("[perf] Step 2: enqueue benchmark sync jobs");
  await runBenchmarkTrigger();

  console.log("[perf] Completed");
}

main().catch((error) => {
  console.error("[perf] failed", error);
  process.exit(1);
});
