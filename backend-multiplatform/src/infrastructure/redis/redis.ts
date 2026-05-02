import IORedis from "ioredis";
import { env } from "../../config/env";

const sharedRedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
} as const;

export const redis = new IORedis(env.REDIS_URL, sharedRedisOptions);
export const redisSubscriber = new IORedis(env.REDIS_URL, sharedRedisOptions);
export const redisPublisher = new IORedis(env.REDIS_URL, sharedRedisOptions);

export async function closeRedisConnections(): Promise<void> {
  await Promise.all([redis.quit(), redisSubscriber.quit(), redisPublisher.quit()]);
}
