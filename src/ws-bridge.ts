import { WebSocketServer, WebSocket } from "ws";
import { CommandResult, WsRequest, WsResponse } from "./types.js";

interface PendingRequest {
  resolve: (value: CommandResult) => void;
  timer: NodeJS.Timeout;
}

export class WsBridge {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();

  constructor(private port: number = 12800) {}

  start(): Promise<void> {
    if (this.wss) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer(
        { host: "127.0.0.1", port: this.port },
        () => resolve()
      );
      this.wss.on("error", (err) => {
        reject(err);
      });
      this.wss.on("connection", (ws) => {
        console.error("[WS] 新客户端连接");
        if (this.client && this.client.readyState === WebSocket.OPEN) {
          this.client.close();
        }
        this.client = ws;

        ws.on("error", () => {
          // Error events lead to close, which is handled below
        });

        ws.on("message", (raw) => {
          let msg: WsResponse;
          try {
            msg = JSON.parse(raw.toString());
          } catch {
            return;
          }
          if (msg.type === "response") {
            console.error(`[WS] 接收响应: id=${msg.id} success=${msg.success}`);
            const p = this.pending.get(msg.id);
            if (p) {
              clearTimeout(p.timer);
              this.pending.delete(msg.id);
              if (msg.success) {
                p.resolve({ success: true, data: msg.data });
              } else {
                p.resolve({ success: false, error: msg.error || "未知错误" });
              }
            } else {
              console.error(`[WS] 未找到对应等待请求: id=${msg.id}`);
            }
          }
        });
        ws.on("close", () => {
          console.error("[WS] 客户端断开");
          this.client = null;
          for (const [id, p] of this.pending) {
            clearTimeout(p.timer);
            p.resolve({ success: false, error: "扩展已断开连接" });
            this.pending.delete(id);
          }
        });
      });
    });
  }

  get connected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  async sendCommand(
    tool: string,
    args: Record<string, unknown> = {},
    timeout: number = 30000
  ): Promise<CommandResult> {
    if (!this.connected) {
      console.error(`[WS] sendCommand: 扩展未连接`);
      return { success: false, error: "扩展未连接。请先打开 Chrome 扩展并点击连接。" };
    }
    const id = crypto.randomUUID();
    const request: WsRequest = { type: "request", id, tool, args };
    console.error(`[WS] 发送请求: ${tool} id=${id}`);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.error(`[WS] 超时: ${tool} id=${id}`);
        this.pending.delete(id);
        resolve({ success: false, error: "操作超时" });
      }, timeout);
      this.pending.set(id, { resolve, timer });
      this.client!.send(JSON.stringify(request));
    });
  }

  stop(): void {
    this.client?.close();
    this.client = null;
    this.wss?.close();
    this.wss = null;
  }
}
