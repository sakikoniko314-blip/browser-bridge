import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WsBridge } from "./ws-bridge.js";
import type { CommandResult } from "./types.js";
import { WsMCPTransport } from "./ws-transport.js";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

const WS_PORT = parseInt(process.env.WS_PORT || "12800", 10);
const bridge = new WsBridge(WS_PORT);
const useWsMCP = process.argv.includes("--ws-mcp");
const mcpWsPort = useWsMCP
  ? parseInt(process.argv[process.argv.indexOf("--ws-mcp") + 1] || "12801")
  : 0;

const server = new Server(
  {
    name: "browser-bridge",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "browser_navigate",
      description: "导航浏览器到指定的 URL",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "要导航到的完整 URL" },
        },
        required: ["url"],
      },
    },
    {
      name: "browser_get_html",
      description: "获取当前页面完整 DOM HTML。当需要查看页面结构、分析 DOM 元素时使用。",
      inputSchema: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS 选择器，不传则返回整个页面",
          },
        },
      },
    },
    {
      name: "browser_get_text",
      description: "获取当前页面纯文本内容（去除 HTML 标签）",
      inputSchema: {
        type: "object",
        properties: {
          selector: {
            type: "string",
            description: "CSS 选择器，不传则返回整个页面文本",
          },
        },
      },
    },
    {
      name: "browser_execute_js",
      description: "在页面中执行 JavaScript 代码。用于操作页面、提取数据、触发事件等。",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "要执行的 JavaScript 代码" },
        },
        required: ["code"],
      },
    },
    {
      name: "browser_click",
      description: "点击页面中匹配 CSS 选择器的元素。点击后返回更新后的 HTML。",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS 选择器" },
        },
        required: ["selector"],
      },
    },
    {
      name: "browser_type_text",
      description: "在输入框中填入文本。填入后返回更新后的 HTML。",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS 选择器" },
          text: { type: "string", description: "要填入的文本" },
        },
        required: ["selector", "text"],
      },
    },
    {
      name: "browser_scroll",
      description: "滚动当前页面",
      inputSchema: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["down", "up"],
            description: "滚动方向，默认 down",
          },
          amount: {
            type: "number",
            description: "滚动像素数，默认 500",
          },
        },
      },
    },
    {
      name: "browser_screenshot",
      description: "对当前页面截图，返回 base64 图片 data URL",
      inputSchema: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["png", "jpeg"],
            description: "图片格式，默认 png",
          },
        },
      },
    },
    {
      name: "browser_get_cookies",
      description: "获取浏览器 Cookie",
      inputSchema: {
        type: "object",
        properties: {
          domain: {
            type: "string",
            description: "按域名过滤（可选）",
          },
        },
      },
    },
    {
      name: "browser_set_cookie",
      description: "设置浏览器 Cookie",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Cookie 名称" },
          value: { type: "string", description: "Cookie 值" },
          domain: { type: "string", description: "Cookie 域名" },
        },
        required: ["name", "value", "domain"],
      },
    },
    {
      name: "browser_get_storage",
      description: "读取页面 localStorage 数据",
      inputSchema: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "指定 key（可选，不传返回所有）",
          },
        },
      },
    },
    {
      name: "browser_list_tabs",
      description: "列出所有打开的标签页",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "browser_close_tab",
      description: "关闭指定标签页",
      inputSchema: {
        type: "object",
        properties: {
          tabId: {
            type: "number",
            description: "标签页 ID（可选，不传则关闭当前标签页）",
          },
        },
      },
    },
    {
      name: "browser_switch_tab",
      description: "激活指定标签页",
      inputSchema: {
        type: "object",
        properties: {
          tabId: { type: "number", description: "标签页 ID" },
        },
        required: ["tabId"],
      },
    },
    {
      name: "browser_press_key",
      description: "模拟按键。用于提交表单(Enter)、关闭弹窗(Escape)等",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "按键名，如 Enter、Escape、Tab、ArrowDown" },
          selector: { type: "string", description: "目标元素的 CSS 选择器（可选，默认当前焦点元素）" },
          ctrl: { type: "boolean", description: "是否按住 Ctrl" },
          shift: { type: "boolean", description: "是否按住 Shift" },
          alt: { type: "boolean", description: "是否按住 Alt" },
          meta: { type: "boolean", description: "是否按住 Meta/Cmd" },
        },
        required: ["key"],
      },
    },
    {
      name: "browser_wait_for_selector",
      description: "等待 CSS 选择器匹配的元素出现。用于等待页面渲染完成",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS 选择器" },
          timeout: { type: "number", description: "超时毫秒数，默认 10000" },
        },
        required: ["selector"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return handleToolCall(name, (args as Record<string, unknown>) || {});
});

async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  console.error(`[MCP] 工具调用: ${name}`);
  try {

    if (name === "browser_wait_for_selector") {
      const selector = args.selector as string;
      const timeout = (args.timeout as number) || 10000;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const r = await bridge.sendCommand("browser_execute_js", {
          code: `document.querySelector('${selector.replace(/'/g, "\\'")}') ? true : false`
        });
        if (r.success && String(r.data) === "true") {
          return { content: [{ type: "text", text: "true" }] };
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return { content: [{ type: "text", text: "false" }] };
    }

    const result: CommandResult = await bridge.sendCommand(name, args);
    console.error(`[MCP] sendCommand 返回: success=${result.success}`);

    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }

    const data = result.data;
    switch (name) {
      case "browser_get_html": {
        if (data === "NOT_FOUND") {
          return {
            content: [{ type: "text", text: `未找到匹配选择器的元素: ${args.selector as string}` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: String(data) }] };
      }
      case "browser_get_text": {
        if (data === "NOT_FOUND") {
          return {
            content: [{ type: "text", text: `未找到匹配选择器的元素: ${args.selector as string}` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: String(data) }] };
      }
      case "browser_execute_js": {
        if (typeof data === "string" && data === "__CSP_BLOCKED__") {
          return { content: [{ type: "text", text: "此网站的安全策略(CSP)禁止执行 JS，请用 get_text / get_html 替代" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "browser_screenshot": {
        const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, "0")).join("");
        const filepath = path.join(tmpdir(), `screenshot-${hex}.png`);
        fs.writeFileSync(filepath, Buffer.from(String(data).split(",")[1], "base64"));
        return { content: [{ type: "text", text: filepath }] };
      }
      case "browser_list_tabs": {
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "browser_get_cookies": {
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "browser_get_storage": {
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "browser_switch_tab":
      case "browser_press_key": {
        return { content: [{ type: "text", text: String(data) }] };
      }
      default: {
        return { content: [{ type: "text", text: String(data ?? "OK") }] };
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text", text: `错误: ${msg}` }], isError: true };
  }
}

async function main() {
  console.error(`WebSocket 服务器启动于 ws://127.0.0.1:${WS_PORT}`);
  await bridge.start();

  if (useWsMCP) {
    const transport = new WsMCPTransport(mcpWsPort);
    console.error(`MCP WS 传输启动于 ws://127.0.0.1:${mcpWsPort}`);
    await server.connect(transport);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((e) => {
  console.error("Server failed:", e);
  process.exit(1);
});
