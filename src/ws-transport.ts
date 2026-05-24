import { WebSocketServer, WebSocket } from "ws";

type MessageHandler = (msg: unknown) => void;
type CloseHandler = () => void;
type ErrorHandler = (err: Error) => void;

export class WsMCPTransport {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;

  onmessage?: MessageHandler;
  onclose?: CloseHandler;
  onerror?: ErrorHandler;

  constructor(private port: number) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer(
        { host: "127.0.0.1", port: this.port },
        () => resolve()
      );
      this.wss.on("error", reject);
      this.wss.on("connection", (ws) => {
        if (this.client) {
          this.client.close();
          this.client = null;
        }
        this.client = ws;
        ws.on("message", (raw) => {
          try {
            this.onmessage?.(JSON.parse(raw.toString()));
          } catch (e) {
            this.onerror?.(e as Error);
          }
        });
        ws.on("close", () => { this.client = null; });
        ws.on("error", (err) => this.onerror?.(err));
      });
    });
  }

  async send(message: unknown): Promise<void> {
    if (!this.client || this.client.readyState !== 1) return;
    console.error("[WS-MCP] send:", (message as any)?.id || "?");
    this.client!.send(JSON.stringify(message) + "\n");
  }

  async close(): Promise<void> {
    this.client?.close();
    this.wss?.close();
  }
}
