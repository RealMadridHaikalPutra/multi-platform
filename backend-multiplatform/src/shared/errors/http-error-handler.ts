import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { DomainError } from "./domain-error";

export function registerGlobalErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const domainError = error instanceof DomainError ? error : null;
    const statusCode = domainError?.statusCode ?? 500;

    app.metrics.trackHttpError(request.url, statusCode);

    request.log.error(
      {
        err: error,
        statusCode,
        requestId: request.id,
        path: request.routerPath
      },
      "request failed"
    );

    reply.status(statusCode).send({
      message: domainError?.message ?? "Internal Server Error",
      code: domainError?.code ?? "INTERNAL_SERVER_ERROR",
      details: domainError?.details
    });
  });
}
