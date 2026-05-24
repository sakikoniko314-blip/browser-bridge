import WebSocket from "ws";

const MCP_PORT = parseInt(process.env.MCP_WS_PORT || "12801");
const MCP_HOST = process.env.MCP_WS_HOST || "ws://127.0.0.1";

function connect() {
  const ws = new WebSocket(`${MCP_HOST}:${MCP_PORT}`);

  ws.on("open", () => {
    let buf = "";
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    process.stdin.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        if (ws.readyState === WebSocket.OPEN) ws.send(line);
      }
    });

    process.stdin.on("end", () => {
      if (buf.trim() && ws.readyState === WebSocket.OPEN) ws.send(buf);
      ws.close();
    });
  });

  ws.on("message", (data) => {
    process.stdout.write(data.toString());
  });

  ws.on("close", () => {
    process.exit(1);
  });

  ws.on("error", () => {
    process.exit(1);
  });
}

connect();
