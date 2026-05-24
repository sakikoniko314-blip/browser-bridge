# Browser Bridge

**让 AI 控制你的浏览器——真·全知全能。**

市面上所有的"AI 浏览器"方案都有致命短板：BrowserMCP 只能读网页的文字快照，看不到 HTML 源码；Playwright MCP 需要新开窗口，没有你的登录态。**Browser Bridge 直接用你正在使用的 Chrome**——你的登录、Cookie、标签页全都在，AI 还能在页面里执行任意 JavaScript。

## 它能干什么

拿实际场景举例：

- "帮我上 B站给某人发私信" → AI 打开 B站、找到用户、填内容、点发送，全程自动化
- "帮我查这个网页上所有 API 请求" → `execute_js` 直接调 `performance.getEntries()`
- "把这个页面截图发给同事" → 截图存到本地文件，直接拖进聊天框
- "帮我导出这个网站的 localStorage" → 一键读取所有本地存储数据

## 和同类产品的区别

| | Browser Bridge | BrowserMCP | Playwright MCP |
|---|---|---|---|
| 用你真实的 Chrome | ✅ | ✅ | ❌ |
| 能看 HTML 源码 | ✅ 完整 DOM | ❌ 只给文字描述 | ✅ |
| 能在页面里跑 JS | ✅ `<script>` 注入 | ❌ | ✅ |
| 自动带登录态 | ✅ Cookie 都在 | ✅ | ❌ 要重新登录 |
| 数据去哪了 | 你自己的电脑 | Agent360 云端 | 本地或无头 |

## 新手安装（5 分钟）

### 第一步：下载代码

打开终端（PowerShell 或 CMD），运行：

```bash
git clone https://github.com/sakikoniko314-blip/browser-bridge.git
cd browser-bridge
```

### 第二步：安装依赖

在上面的终端里继续（确保还在 `browser-bridge` 目录）：

```bash
npm install
npm run build
```

### 第三步：一键配置

```bash
node setup.mjs
```

运行后会提示你：
1. 打开 `chrome://extensions/`
2. 右上角打开"开发者模式"
3. 点"加载已解压的扩展程序"
4. 选择 `browser-bridge/extension/` 文件夹
5. 记下扩展的 ID（一串字母），填回终端

### 第四步：连接

1. Chrome 右上角点扩展图标（拼图）→ 找到 Browser Bridge → 点图钉固定
2. 点扩展图标 → 点 **Connect** → 看到绿色圆点和 "Connected"
3. 搞定！

### 第五步：配置 opencode

打开 `C:\Users\你的用户名\.config\opencode\opencode.json`，找到 `mcp` 部分，加上：

```json
"browser-bridge": {
  "type": "local",
  "command": ["node", "你的路径\\browser-bridge\\bridge.mjs"],
  "enabled": true
}
```

注意把 `你的路径` 换成实际路径，比如 `D:\\workspace\\browser-bridge\\bridge.mjs`。

### 第六步：重启 opencode

关掉重开。然后就能用了。在 opencode 里直接说"帮我打开 B站"就行。

## 工具速查

| 想做什么 | 用什么工具 |
|---|---|
| 打开一个网址 | `browser_navigate` |
| 看页面文字内容 | `browser_get_text` |
| 看页面 HTML 源码 | `browser_get_html` |
| 在页面里执行 JS | `browser_execute_js` |
| 点击一个按钮 | `browser_click` |
| 输入文字 | `browser_type_text` |
| 按键盘（回车、Esc）| `browser_press_key` |
| 滚动页面 | `browser_scroll` |
| 截图 | `browser_screenshot` |
| 等待某个元素出现 | `browser_wait_for_selector` |
| 切换标签页 | `browser_switch_tab` |
| 关闭标签页 | `browser_close_tab` |
| 查看所有标签页 | `browser_list_tabs` |
| 获取/设置 Cookie | `browser_get_cookies`、`browser_set_cookie` |
| 读取 localStorage | `browser_get_storage` |

## 常见问题

**Q: 为什么扩展过一会就断了？**

Chrome 会在 30 秒不操作后自动关掉扩展。点一下扩展图标重新 Connect 就行。放心，不会丢失配置。

**Q: execute_js 返回 null？**

有些网站（如 GitHub、Bing）有严格的安全策略，禁止注入 JS。这是网站的自我保护。对于这些网站可以用 `get_html` + `get_text` 代替。

**Q: 安全吗？**

所有通信都在你本机完成——openCode → MCP Server → Chrome 扩展 → 你的浏览器。没有任何数据上传到云端。扩展也不会上传你的浏览记录或密码。

## 技术支持

有问题提 [Issues](https://github.com/sakikoniko314-blip/browser-bridge/issues)。
