import { randomUUID } from "node:crypto";
import type IORedis from "ioredis";
import { sleep } from "../../shared/utils/sleep";

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class DistributedLockService {
  constructor(private readonly redis: IORedis) {}

  async withLock<T>(key: string, ttlMs: number, callback: () => Promise<T>): Promise<T> {
    const token = await this.acquire(key, ttlMs);

    try {
      return await callback();
    } finally {
      await this.release(key, token);
    }
  }

  private async acquire(key: string, ttlMs: number): Promise<string> {
    const token = randomUUID();
    const maxWaitMs = Math.max(2 * ttlMs, 15_000);
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      const isLocked = await this.redis.set(key, token, "PX", ttlMs, "NX");
      if (isLocked === "OK") {
        return token;
      }

      await sleep(100);
    }

    throw new Error(`failed to acquire lock for key=${key}`);
  }

  private async release(key: string, token: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
  }
}
