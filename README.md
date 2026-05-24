# Browser Bridge

**让 AI 控制你真实的 Chrome 浏览器——完整 DOM、JS 注入、Cookie、截图。不走云端，不上传数据。**

```
opencode → MCP Server → Chrome 扩展 → 你真实的浏览器
```

## 为什么重复造轮子

| | Browser Bridge | BrowserMCP | Playwright MCP |
|---|---|---|---|
| 用你真实的 Chrome | ✅ | ✅ | ❌ 新窗口/headless |
| 完整 HTML 源码 | ✅ 650KB B站首页 | ❌ 只给 accessibility tree | ✅ |
| 任意 JS 执行 | ✅ `<script>` 注入 | ❌ | ✅ inject |
| 免登录 | ✅ 天然带 Cookie | ✅ | ❌ 需手动登录 |
| Cookie 读写 | ✅ | ✅ | 需要配置 |
| CSP 页面可用 | ✅ DOM 注入绕过 | N/A | 无限制 |
| 数据隐私 | ✅ 纯本地 | ❌ 走 Agent360 云 | ✅ 本地 |

## 16 个 MCP 工具

| 分类 | 工具 |
|---|---|
| 🧭 导航 | `browser_navigate`, `browser_switch_tab` |
| 📄 DOM | `browser_get_html`, `browser_get_text` |
| ⚡ JS | `browser_execute_js` ✨ |
| 🖱️ 交互 | `browser_click`, `browser_type_text`, `browser_press_key`, `browser_scroll` |
| ⏳ 等待 | `browser_wait_for_selector` |
| 🗂️ 标签 | `browser_list_tabs`, `browser_close_tab` |
| 🍪 存储 | `browser_get_cookies`, `browser_set_cookie`, `browser_get_storage` |
| 📸 截图 | `browser_screenshot`（存本地文件） |

## 安装

```bash
git clone https://github.com/{你的用户名}/browser-bridge.git
cd browser-bridge
npm install
npm run build
node setup.mjs
```

然后 `chrome://extensions/` → 开发者模式 → 加载已解压 → 选 `extension/` 目录。

opencode 配置里加一行：

```json
"browser-bridge": {
  "type": "local",
  "command": ["node", "D:\\path\\to\\browser-bridge\\bridge.mjs"],
  "enabled": true
}
```

## 架构

```
Chrome 扩展 (MV3) ← WebSocket → MCP Server ← MCP 协议 → opencode
       ↓
  Native Host → 自动启停 MCP Server
```

- **扩展**：16 个工具的实际执行者，通过 Chrome API 操控浏览器
- **MCP Server**：接收 opencode 指令，转发给扩展
- **Bridge**：opencode stdio ↔ WebSocket 双向转发
- **Native Host**：扩展一键启动/停止 MCP Server

## 与同类方案的核心差异

1. **BrowserMCP** 只返回 accessibility tree（几十 KB 的文本快照），拿不到 HTML。曾经用它读 B站视频列表，根本找不到 dom 元素。
2. **Playwright MCP** 能拿 HTML，但要新开窗口，没有登录态，每次都要重新登录。
3. **Browser Bridge** 直接用你正在用的 Chrome——所有 cookie、localStorage、登录态都在。还能通过 `<script>` 注入在页面里直接执行 JS，操作 Vue/React 的状态。
