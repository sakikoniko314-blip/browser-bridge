const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const MCP_DIR = path.resolve(__dirname, "..");
const MCP_SERVER = path.join(MCP_DIR, "dist", "index.js");
const MCP_WS_PORT = process.env.MCP_WS_PORT || "12801";

let mcpProcess = null;

function readMessage() {
  const header = process.stdin.read(4);
  if (!header) return null;
  const len = header.readUInt32LE(0);
  if (len <= 0 || len > 10 * 1024 * 1024) return null;
  const body = process.stdin.read(len);
  if (!body) return null;
  try { return JSON.parse(body.toString("utf-8")); } catch { return null; }
}

function sendMessage(msg) {
  const json = JSON.stringify(msg);
  const buf = Buffer.alloc(4 + Buffer.byteLength(json));
  buf.writeUInt32LE(Buffer.byteLength(json), 0);
  buf.write(json, 4);
  process.stdout.write(buf);
}

function startMCPServer() {
  if (mcpProcess && !mcpProcess.killed) return true;
  try {
    mcpProcess = spawn("node", [MCP_SERVER, "--ws-mcp", MCP_WS_PORT], {
      cwd: MCP_DIR,
      stdio: "ignore",
      detached: true,
    });
    mcpProcess.unref();
    mcpProcess.on("exit", () => { mcpProcess = null; });
    return true;
  } catch (e) {
    return false;
  }
}

function stopMCPServer() {
  if (mcpProcess && !mcpProcess.killed) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

process.stdin.on("readable", () => {
  const msg = readMessage();
  if (!msg) return;
  if (msg.type === "start") {
    const ok = startMCPServer();
    sendMessage({ type: "started", ok });
  } else if (msg.type === "stop") {
    stopMCPServer();
    sendMessage({ type: "stopped" });
  } else if (msg.type === "status") {
    sendMessage({
      type: "status",
      running: mcpProcess !== null && !mcpProcess.killed,
    });
  }
});

process.stdin.on("end", () => {
  process.exit(0);
});

startMCPServer();
