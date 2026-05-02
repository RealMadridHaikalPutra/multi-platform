import { buildApp } from "./app";
import { env } from "./config/env";

async function start(): Promise<void> {
  const { app } = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: env.HOST
    });

    app.log.info({
      host: env.HOST,
      port: env.PORT
    }, "server started");
  } catch (error) {
    app.log.fatal({ err: error }, "failed to start server");
    process.exit(1);
  }
}

void start();
