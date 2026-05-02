import type { FastifyInstance } from "fastify";

type SocketLike = {
  readyState: number;
  send: (payload: string) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
};

export class WsGateway {
  private readonly clients = new Set<SocketLike>();

  register(app: FastifyInstance): void {
    app.get("/ws", { websocket: true }, (connection: any) => {
      const socket: SocketLike = connection?.socket ?? connection;
      this.clients.add(socket);

      socket.on("message", (raw: unknown) => {
        const message = String(raw ?? "");
        if (message.toLowerCase() === "ping") {
          socket.send(JSON.stringify({ event: "pong", payload: { ts: Date.now() } }));
        }
      });

      socket.on("close", () => {
        this.clients.delete(socket);
      });
    });
  }

  publish(event: string, payload: unknown): void {
    const body = JSON.stringify({
      event,
      payload,
      sentAt: new Date().toISOString()
    });

    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(body);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
