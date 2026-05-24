let ws = null;
let wsUrl = 'ws://127.0.0.1:12800';
let reconnectTimer = null;
let connGen = 0;

function ensureServerViaNative() {
  return new Promise((resolve) => {
    let timeout = setTimeout(() => resolve(false), 5000);
    try {
      const port = chrome.runtime.connectNative('com.browserbridge');
      port.onMessage.addListener((msg) => {
        if (msg.type === 'started') {
          clearTimeout(timeout);
          port.disconnect();
          resolve(msg.ok);
        }
      });
      port.onDisconnect.addListener(() => {
        clearTimeout(timeout);
        resolve(false);
      });
      port.postMessage({ type: 'start' });
    } catch (e) {
      console.error('ensureServerViaNative error:', e);
      clearTimeout(timeout);
      resolve(false);
    }
  }).then((ok) => {
    if (ok) return new Promise((r) => setTimeout(r, 1500));
    return false;
  });
}

function stopServerViaNative() {
  let timeout = setTimeout(() => {}, 3000);
  try {
    const port = chrome.runtime.connectNative('com.browserbridge');
    port.onMessage.addListener(() => { clearTimeout(timeout); port.disconnect(); });
    port.postMessage({ type: 'stop' });
  } catch (e) {
    console.error('stopServerViaNative error:', e);
  }
}

function connect(url) {
  if (url) wsUrl = url;
  const gen = ++connGen;
  if (ws) ws.close();
  clearTimeout(reconnectTimer);
  chrome.storage.session.set({ bridgeConnected: true, bridgeUrl: wsUrl }, () => {});
  try {
    ws = new WebSocket(wsUrl);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    if (gen !== connGen) return;
    setBadge('ON', '#4CAF50');
  };

  ws.onclose = () => {
    if (gen !== connGen) return;
    ws = null;
    setBadge('OFF', '#9E9E9E');
    chrome.storage.session.get('bridgeConnected', (res) => {
      if (res.bridgeConnected) scheduleReconnect();
    });
  };

  ws.onerror = () => {
    if (gen !== connGen) return;
    setBadge('ERR', '#F44336');
  };

  ws.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.type !== 'request') return;
    setBadge(msg.tool?.substring(8, 12) || '?', '#2196F3');

    try {
      const data = await executeTool(msg.tool, msg.args || {});
      setBadge('OK', '#4CAF50');
      try { ws.send(JSON.stringify({ type: 'response', id: msg.id, success: true, data })); } catch (e) { console.error('ws.send response error:', e); }
    } catch (e) {
      setBadge('ERR', '#F44336');
      try { ws.send(JSON.stringify({ type: 'response', id: msg.id, success: false, error: e.message })); } catch (e2) { console.error('ws.send error response failed:', e2); }
    }
  };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    ensureServerViaNative().then(() => connect());
  }, 3000);
}

function disconnect() {
  clearTimeout(reconnectTimer);
  chrome.storage.session.set({ bridgeConnected: false });
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  stopServerViaNative();
  setBadge('OFF', '#9E9E9E');
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!tabs || tabs.length === 0) return reject(new Error('No active tab found'));
      resolve(tabs[0]);
    });
  });
}

function executeInPage(fn, args = []) {
  return new Promise((resolve, reject) => {
    getActiveTab().then((tab) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: fn,
          args: args,
          world: "MAIN",
        }
      ).then((results) => {
        if (!results || results.length === 0) return reject(new Error("Script execution returned no results"));
        resolve(results[0].result);
      }).catch(reject);
    }).catch(reject);
  });
}

function executeInIsolated(fn, args = []) {
  return new Promise((resolve, reject) => {
    getActiveTab().then((tab) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: fn,
          args: args,
          world: "ISOLATED",
        }
      ).then((results) => {
        if (!results || results.length === 0) return reject(new Error("Script execution returned no results"));
        resolve(results[0].result);
      }).catch(reject);
    }).catch(reject);
  });
}

async function executeTool(tool, args) {
  switch (tool) {
    case 'browser_navigate': {
      const tab = await getActiveTab();
      const tabId = tab.id;
      await chrome.tabs.update(tabId, { url: args.url });
      let done = false;
      const listener = (id, info) => {
        if (!done && id === tabId && info.status === 'complete') {
          done = true;
          chrome.tabs.onUpdated.removeListener(listener);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      await new Promise(r => setTimeout(() => {
        if (!done) { done = true; chrome.tabs.onUpdated.removeListener(listener); }
        r();
      }, 15000));
      return { tabId, url: args.url };
    }

    case 'browser_get_html': {
      if (args.selector) {
        return await executeInPage((sel) => {
          const el = document.querySelector(sel);
          return el ? el.outerHTML : 'NOT_FOUND';
        }, [args.selector]);
      }
      return await executeInPage(() => document.documentElement.outerHTML);
    }

    case 'browser_get_text': {
      if (args.selector) {
        return await executeInPage((sel) => {
          const el = document.querySelector(sel);
          return el ? (el.innerText || el.textContent) : 'NOT_FOUND';
        }, [args.selector]);
      }
      return await executeInPage(() => document.body?.innerText || document.documentElement.textContent || '');
    }

    case 'browser_execute_js': {
      return await executeInPage((code) => {
        var id = '_bc_' + Math.random().toString(36).slice(2);
        var sentinel = {};
        window[id] = sentinel;
        var s = document.createElement('script');
        s.textContent = 'window["' + id + '"]=JSON.stringify((function(){try{return eval(' + JSON.stringify(code) + ')}catch(e){return{error:e.message}}})())';
        (document.head || document.documentElement).appendChild(s);
        s.remove();
        var r = window[id];
        delete window[id];
        if (r === sentinel) return '__CSP_BLOCKED__';
        return r;
      }, [args.code]);
    }

    case 'browser_click': {
      var tab = await getActiveTab();
      var info = await executeInPage(function(sel) {
        var el = document.querySelector(sel);
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        var r = el.getBoundingClientRect();
        var formInput = el.tagName === 'INPUT' ? el : el.closest('form')?.querySelector('input:not([type="hidden"])');
        if (formInput) formInput.scrollIntoView({ block: 'center' });
        var fi = formInput ? formInput.getBoundingClientRect() : null;
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), isSubmit: !!el.closest('form') || el.matches('[type="submit"],button[type="submit"]'), ix: fi ? Math.round(fi.x + fi.width / 2) : 0, iy: fi ? Math.round(fi.y + fi.height / 2) : 0, in: !!formInput };
      }, [args.selector]);
      if (!info) return 'NOT_FOUND';
      try {
        await new Promise(function(resolve, reject) {
          chrome.debugger.attach({ tabId: tab.id }, '1.3', function() {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (info.isSubmit && info.in) {
              chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: info.ix, y: info.iy, modifiers: 0, button: 'left', clickCount: 1 }, function() {
                chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: info.ix, y: info.iy, modifiers: 0, button: 'left', clickCount: 1 }, function() {
                  chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: 0, windowsVirtualKeyCode: 13, key: 'Enter', code: 'Enter' }, function() {
                    chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 0, windowsVirtualKeyCode: 13, key: 'Enter', code: 'Enter' }, function() {
                      chrome.debugger.detach({ tabId: tab.id }, resolve);
                    });
                  });
                });
              });
            } else {
              chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: info.x, y: info.y, modifiers: 0, button: 'left', clickCount: 1 }, function() {
                chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: info.x, y: info.y, modifiers: 0, button: 'left', clickCount: 1 }, function() {
                  chrome.debugger.detach({ tabId: tab.id }, resolve);
                });
              });
            }
          });
        });
      } catch(e) {
        console.error('CDP click failed, fallback:', e.message);
        return await executeInPage(function(sel) {
          var el = document.querySelector(sel);
          if (!el) return 'NOT_FOUND';
          if (el instanceof HTMLElement) el.focus();
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return document.documentElement.outerHTML;
        }, [args.selector]);
      }
      return await executeInPage(function() { return document.documentElement.outerHTML; });
    }

    case 'browser_type_text': {
      var tab = await getActiveTab();
      var elInfo = await executeInPage(function(sel) {
        var el = document.querySelector(sel);
        if (!el) return null;
        el.focus();
        return { tag: el.tagName, isInput: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement, type: el.type || '' };
      }, [args.selector]);
      if (!elInfo) return 'NOT_FOUND';
      if (elInfo.isInput) {
        try {
          await new Promise(function(resolve, reject) {
            chrome.debugger.attach({ tabId: tab.id }, '1.3', function() {
              if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
              chrome.debugger.sendCommand({ tabId: tab.id }, 'Input.insertText', { text: args.text }, function() {
                chrome.debugger.detach({ tabId: tab.id }, resolve);
              });
            });
          });
          return await executeInPage(function() { return document.documentElement.outerHTML; });
        } catch(e) {
          return await executeInPage(function(sel, text) {
            var el = document.querySelector(sel);
            if (!el) return 'NOT_FOUND';
            el.focus();
            var nativeSetter = Object.getOwnPropertyDescriptor(el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype, 'value').set;
            nativeSetter.call(el, text);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
            return document.documentElement.outerHTML;
          }, [args.selector, args.text]);
        }
      } else {
        return await executeInPage(function(sel, text) {
          var el = document.querySelector(sel);
          if (!el) return 'NOT_FOUND';
          el.focus();
          el.textContent = '';
          el.focus();
          var sel2 = window.getSelection();
          if (sel2) { sel2.selectAllChildren(el); sel2.collapseToEnd(); }
          document.execCommand('insertText', false, text);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
          return document.documentElement.outerHTML;
        }, [args.selector, args.text]);
      }
    }

    case 'browser_scroll': {
      return await executeInPage((direction, amount) => {
        const scrollAmount = amount || 500;
        if (direction === 'up') {
          window.scrollBy(0, -scrollAmount);
        } else {
          window.scrollBy(0, scrollAmount);
        }
        return { scrollX: window.scrollX, scrollY: window.scrollY };
      }, [args.direction || 'down', args.amount]);
    }

    case 'browser_get_cookies': {
      return new Promise((resolve, reject) => {
        const query = args.domain ? { domain: args.domain } : {};
        chrome.cookies.getAll(query, (cookies) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve(cookies);
        });
      });
    }

    case 'browser_set_cookie': {
      return new Promise((resolve, reject) => {
        chrome.cookies.set({
          name: args.name,
          value: args.value,
          domain: args.domain,
          url: `https://${args.domain}`,
        }, (cookie) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve(cookie || { success: true });
        });
      });
    }

    case 'browser_get_storage': {
      if (args.key) {
        return await executeInPage((k) => localStorage.getItem(k), [args.key]);
      }
      return await executeInPage(() => JSON.parse(JSON.stringify(localStorage)));
    }

    case 'browser_list_tabs': {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({}, (tabs) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve(tabs.map(t => ({
            id: t.id,
            title: t.title,
            url: t.url,
            active: t.active,
            windowId: t.windowId,
          })));
        });
      });
    }

    case 'browser_close_tab': {
      const tabId = args.tabId || (await getActiveTab()).id;
      return new Promise((resolve, reject) => {
        chrome.tabs.remove(tabId, () => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve({ closed: tabId });
        });
      });
    }

    case 'browser_switch_tab': {
      return new Promise((resolve, reject) => {
        chrome.tabs.update(args.tabId, { active: true }, (tab) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve({ id: tab.id, title: tab.title, url: tab.url });
        });
      });
    }

    case 'browser_press_key': {
      return await executeInPage((k, sel, ctrl, shift, alt, meta) => {
        var el = sel ? document.querySelector(sel) : document.activeElement;
        if (!el) return JSON.stringify({ error: 'Element not found: ' + (sel || 'activeElement') });
        var opts = { key: k, code: k, bubbles: true, cancelable: true, ctrlKey: !!ctrl, shiftKey: !!shift, altKey: !!alt, metaKey: !!meta };
        el.dispatchEvent(new KeyboardEvent('keydown', opts));
        el.dispatchEvent(new KeyboardEvent('keypress', opts));
        el.dispatchEvent(new KeyboardEvent('keyup', opts));
        return JSON.stringify({ ok: true, key: k, tag: el.tagName });
      }, [args.key, args.selector || null, args.ctrl || false, args.shift || false, args.alt || false, args.meta || false]);
    }

    case 'browser_wait_for_selector': {
      return await executeInPage((sel) => {
        return JSON.stringify(!!document.querySelector(sel));
      }, [args.selector]);
    }

    case 'browser_screenshot': {
      const tab = await getActiveTab();
      const format = args.format || 'png';
      return new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(tab.windowId, { format: format, quality: format === 'jpeg' ? args.quality : undefined }, (dataUrl) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve(dataUrl);
        });
      });
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'connect') {
    ensureServerViaNative().then((ok) => { connect(msg.url); });
    sendResponse({ ok: true });
  } else if (msg.type === 'disconnect') {
    disconnect();
    sendResponse({ ok: true });
  } else if (msg.type === 'getStatus') {
    sendResponse({ connected: ws !== null && ws.readyState === WebSocket.OPEN });
  }
  return true;
});

chrome.alarms.create('keepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    chrome.storage.session.get('bridgeConnected', (res) => {
      if (res.bridgeConnected && (!ws || ws.readyState !== WebSocket.OPEN)) {
        ensureServerViaNative().then(() => connect());
      }
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.session.get('bridgeConnected', (res) => {
    if (res.bridgeConnected) ensureServerViaNative().then((ok) => { if (ok) connect(); });
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.get('bridgeConnected', (res) => {
    if (res.bridgeConnected) ensureServerViaNative().then((ok) => { if (ok) connect(); });
  });
});
