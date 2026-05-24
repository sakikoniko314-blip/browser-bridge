#!/usr/bin/env node
import { execSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import readline from "readline";

const PACKAGE_ROOT = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const APPDATA = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
const BRIDGE_DIR = join(APPDATA, "browser-bridge");
const EXT_DIR = join(BRIDGE_DIR, "extension");
const HOST_DIR = join(BRIDGE_DIR, "native-host");
const HOST_NAME = "com.browserbridge";
const REG_KEY = `HKEY_CURRENT_USER\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;

function log(msg) {
  console.log(`\x1b[36m>\x1b[0m ${msg}`);
}

function warn(msg) {
  console.log(`\x1b[33m!\x1b[0m ${msg}`);
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
  console.log(`
\x1b[35m╔══════════════════════════════════╗
║   \x1b[1mBrowser Bridge Setup\x1b[0m\x1b[35m       ║
║   MCP Server + Chrome Extension  ║
╚══════════════════════════════════╝\x1b[0m
`);

  log(`安装目录: ${BRIDGE_DIR}`);

  // 1. Copy extension
  log("复制扩展文件...");
  mkdirSync(EXT_DIR, { recursive: true });
  const srcExt = join(PACKAGE_ROOT, "extension");
  if (!existsSync(srcExt)) {
    warn("未找到 extension/ 目录，跳过");
  } else {
    for (const f of readdirSync(srcExt)) {
      copyFileSync(join(srcExt, f), join(EXT_DIR, f));
    }
    log(`扩展已复制到: ${EXT_DIR}`);
  }

  // 2. Copy native host files
  log("复制 Native Host 文件...");
  mkdirSync(HOST_DIR, { recursive: true });
  const srcHost = join(PACKAGE_ROOT, "native-host");
  if (!existsSync(srcHost)) {
    warn("未找到 native-host/ 目录，跳过");
  } else {
    for (const f of readdirSync(srcHost).filter(x => x.endsWith(".cjs") || x.endsWith(".bat"))) {
      copyFileSync(join(srcHost, f), join(HOST_DIR, f));
    }
    log("Native Host 文件已复制");
  }

  // 3. Get extension ID
  const existingManifest = join(HOST_DIR, `${HOST_NAME}.json`);
  let extId = "";
  if (existsSync(existingManifest)) {
    try {
      const old = JSON.parse(readFileSync(existingManifest, "utf-8"));
      extId = old.allowed_origins?.[0]?.replace("chrome-extension://", "").replace("/", "") || "";
    } catch {}
  }
  
  if (extId) {
    log(`使用已有扩展 ID: ${extId}`);
  } else {
    console.log("\n请先加载扩展获取 ID：");
    console.log(`  chrome://extensions/ → 开发者模式 → 加载已解压 → 选择: ${EXT_DIR}\n`);
    extId = await ask("输入扩展 ID (chrome://extensions/ 里可见): ");
  }

  // 4. Create native host manifest
  log("创建 Native Host 注册表清单...");
  const manifest = {
    name: HOST_NAME,
    description: "Browser Bridge MCP Server Manager",
    path: join(HOST_DIR, "host.bat"),
    type: "stdio",
    allowed_origins: [`chrome-extension://${extId}/`]
  };
  writeFileSync(existingManifest, JSON.stringify(manifest, null, 2));
  log(`清单已保存: ${existingManifest}`);

  // 5. Register native host
  log("注册 Native Host...");
  try {
    execSync(`reg add "${REG_KEY}" /ve /t REG_SZ /d "${existingManifest}" /f`, { stdio: "pipe" });
    log("注册表写入成功");
  } catch (e) {
    warn(`注册表写入失败: ${e.message}`);
    warn(`请手动运行: reg add "${REG_KEY}" /ve /t REG_SZ /d "${existingManifest.replace(/\//g, '\\')}" /f`);
  }

  // 6. Update bridge.js (port) not needed, uses default 12801

  console.log(`\n\x1b[32m✓ 安装完成\x1b[0m\n`);
  console.log("后续步骤:");
  console.log(` 1. chrome://extensions/ → 刷新扩展`);
  console.log(` 2. 打开扩展 popup → 点 Connect`);
  console.log(` 3. opencode 配置 (已自动): `);
  console.log(`    "browser-bridge": {"type":"local","command":["node","${join(PACKAGE_ROOT, "bridge.mjs").replace(/\\/g, "\\\\")}"]}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
