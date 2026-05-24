# Browser Bridge

**让 AI 控制你的真实浏览器——完整 DOM / JS 执行 / Cookie / 截图**

```
opencode ←── stdio ──→ MCP Server ←── WS ──→ Chrome Extension ←── Chrome API ──→ 浏览器
```

## 与市面方案对比

| | Browser Bridge | BrowserMCP | Playwright MCP |
|---|---|---|---|
| 浏览器 | 你真实的 Chrome | 你真实的 Chrome | Headless 或新窗口 |
| HTML 源码 | ✅ 完整 DOM | ❌ 只给 accessibility tree | ✅ |
| JS 执行 | ✅ 页面级 `<script>` 注入 | ❌ | ✅ (inject) |
| 登录态 | ✅ 天然自带 | ✅ | ❌ 需要手动配 |
| Cookie | ✅ 读写 | ✅ | 需要额外配置 |
| 截图 | ✅ 直接存文件 | ✅ 能截图 | ✅ |
| CSP 限制 | 绕过（DOM 注入） | N/A | 无限制 |
| 隐私 | 纯本地 | 走云（Agent360） | 纯本地 |

## 安装

```bash
git clone https://github.com/your/browser-bridge.git
cd browser-bridge
npm install
npm run build
node setup.mjs
```

## 工具列表 (16)

| 分类 | 工具 |
|---|---|
| 导航 | `browser_navigate`、`browser_switch_tab` |
| DOM | `browser_get_html`、`browser_get_text` |
| JS | `browser_execute_js` ✅ 核心亮点 |
| 交互 | `browser_click`、`browser_type_text`、`browser_press_key`、`browser_scroll` |
| 等待 | `browser_wait_for_selector` |
| 标签 | `browser_list_tabs`、`browser_close_tab` |
| 存储 | `browser_get_cookies`、`browser_set_cookie`、`browser_get_storage` |
| 截图 | `browser_screenshot`（存本地文件） |

## 架构

```
扩展 (MV3 Service Worker)
  ├── WebSocket → MCP Server (port 12800)
  ├── Native Messaging → Native Host → 自启动 MCP Server
  └── chrome.alarms → 保活

MCP Server (Node.js)
  ├── WsBridge (12800) → 扩展通信
  ├── WsMCPTransport (12801) → opencode 通信
  └── 13 个 MCP 工具

Bridge (bridge.mjs)
  └── opencode stdio ↔ WebSocket (12801) 转发
```

## 开发

```bash
npm run build    # 编译 TypeScript
node dist/index.js --ws-mcp 12801   # 启动 MCP Server
```

刷新扩展：`chrome://extensions/` → 开发者模式 → 加载已解压 → 选择 `extension/`
