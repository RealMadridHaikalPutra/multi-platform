import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../../config/env";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 10_000
});

export const db = drizzle(pool, {
  schema,
  logger: env.NODE_ENV === "development"
});

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
