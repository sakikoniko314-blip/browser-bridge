# Browser Bridge

**AI 控制你真实的 Chrome——完整 DOM、JS 注入、CDP 交互。16 个 MCP 工具，纯本地。**

`npx @sakiko111/browser-bridge`

---

## 为什么选这个

| 你想要什么 | Browser Bridge | BrowserMCP | Playwright MCP |
|---|---|---|---|
| 在 opcode/Claude Code 里直接控浏览器 | ✅ 16 个工具 | ✅ 能导航点链接 | ✅ 工具更多 |
| 获取完整 HTML 源码 | ✅ **650KB B站首页一次返回** | ❌ 只给 accessibility tree 快照 | ✅ |
| 不用重新登录 | ✅ **直接用你当前的 Chrome** | ✅ | ❌ 开新窗口 |
| 填 React / Vue 表单 | ✅ CDP `Input.insertText` | ❌ | ✅ Playwright |
| 在页面上跑任意 JS | ✅ `<script>` 注入 | ❌ | ✅ `page.evaluate` |
| CSP 严格页面也能跑（GitHub/Bing） | ❌ 已知限制 | N/A | ❌ 同样限制 |
| 点 React 提交按钮 | ✅ 普通表单 OK，GitHub Turbo ❌ | ❌ 根本点不了 | ✅ Playwright |
| 截图 | ✅ 存本地文件，不返回 base64 | ✅ | ✅ |
| 安装步骤 | **3 分钟** | 1 分钟 | 5 分钟 |
| 隐私 | ✅ **纯本地，不上传任何数据** | ❌ 走 Agent360 云 | ✅ |

## 30 秒快速开始

```bash
npx @sakiko111/browser-bridge
cd node_modules/@sakiko111/browser-bridge
npm install && npm run build
node setup.mjs
```

然后 `chrome://extensions/` → 加载已解压 → 选 `extension/` 文件夹。

详细步骤：[新手安装指南](#新手安装-5-分钟)

## 16 个 MCP 工具

| 分类 | 工具 | 实测 |
|---|---|---|
| 🧭 导航 | `browser_navigate`、`browser_switch_tab` | ✅ |
| 📄 DOM | `browser_get_html`、`browser_get_text` | ✅ 650KB HTML |
| ⚡ JS | `browser_execute_js` | ✅ CSP 页面友好提示 |
| 🖱️ 交互 | `browser_click`、`browser_type_text`、`browser_press_key`、`browser_scroll` | ✅ CDP 增强 |
| ⏳ 等待 | `browser_wait_for_selector` | ✅ 服务端轮询 |
| 🗂️ 标签 | `browser_list_tabs`、`browser_close_tab` | ✅ |
| 🍪 存储 | `browser_get_cookies`、`browser_set_cookie`、`browser_get_storage` | ✅ |
| 📸 截图 | `browser_screenshot` | ✅ 存 tmp 不占对话 |

## 技术亮点

### 1. 完整 HTML 源码（不是快照）

```javascript
browser_get_html()  // 返回整页 DOM，不是 accessibility tree
```

BrowserMCP 只返回几十 KB 的文本快照，很多元素缺失。Browser Bridge 返回完整的 HTML——B站首页 650KB，一个元素不少。

### 2. JS 注入（绕过扩展 CSP）

```javascript
browser_execute_js({ code: "document.title" })
// 返回: "哔哩哔哩 (゜-゜)つロ 干杯~-bilibili"
```

通过 `<script>` 标签注入到页面执行，绕过 Chrome 扩展自身 CSP。被页面 CSP 阻拦时自动返回友好提示。

### 3. React 表单填充（CDP `Input.insertText`）

```javascript
browser_type_text({ selector: "#repository-name-input", text: "my-repo" })
// ✓ 填进去了，不依赖 dispatchEvent
```

绕过 React 的 value setter，调用原生 `HTMLInputElement.prototype.value.set`，再触发事件。GitHub 的表单实测可用。

### 4. 保活机制

Chrome MV3 30 秒会杀掉 ServiceWorker。Browser Bridge 每 15 秒发 WS ping 保持活跃，断了自动重连。

### 5. 一键启动（Native Messaging）

扩展点 Connect → 自动启动 MCP Server。不需要手动开终端。Native Host 注册在 HKCU，无需管理员权限。

## 已知限制

| 问题 | 原因 | 状态 |
|---|---|---|
| `execute_js` 在 GitHub/Bing 无法执行 | 页面 CSP 拦截 `<script>` | 返回友好提示 |
| `browser_click` 无法提交 GitHub 表单 | Turbo 框架特殊防护, CDP 事件被拦截 | 普通表单正常 |
| React 按钮事件 | 非用户手势的 dispatchEvent 被框架过滤 | CDP 可解决大部分 |
| MV3 30 秒保活 | Chrome 机制 | WS 15 秒 ping 解决 |

## 与技术方案对比

| | Browser Bridge | Playwright MCP |
|---|---|---|
| CDP 事件 | 扩展内 `chrome.debugger` | 启动独立浏览器 |
| 登录态 | ✅ 你的 Chrome | ❌ 新窗口 |
| 填 React 表单 | ✅ CDP insertText | ✅ |
| 提交 React 表单 | ✅ 普通网站，❌ GitHub Turbo | ✅ |
| 启动速度 | 瞬发（已有 Chrome） | 慢（启动浏览器） |
| 依赖 | Node.js + Chrome | Playwright + 浏览器 |

## 新手安装（5 分钟）

### 第一步：下载

```bash
git clone https://github.com/sakikoniko314-blip/browser-bridge.git
cd browser-bridge
```

### 第二步：安装依赖

```bash
npm install
npm run build
```

### 第三步：配置扩展

```bash
node setup.mjs
```

按提示操作：
1. 打开 `chrome://extensions/`
2. 右上角打开"开发者模式"
3. 点"加载已解压的扩展程序"
4. 选择 `extension/` 文件夹
5. 记下扩展 ID，填回终端

### 第四步：连接

1. Chrome 右上角扩展图标 → 固定 Browser Bridge
2. 点 **Connect** → 绿色圆点 Connected

### 第五步：配置 opocode

`C:\Users\你的用户名\.config\opencode\opencode.json`:

```json
"browser-bridge": {
  "type": "local",
  "command": ["node", "D:\\workspace\\browser-bridge\\bridge.mjs"],
  "enabled": true
}
```

重启 opecode。

## npm 安装（替代方式）

```bash
npm install -g @sakiko111/browser-bridge
browser-bridge
```

## 项目地址

[https://github.com/sakikoniko314-blip/browser-bridge](https://github.com/sakikoniko314-blip/browser-bridge)
