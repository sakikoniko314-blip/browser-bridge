const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const wsUrl = document.getElementById('wsUrl');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const extensionIdEl = document.getElementById('extensionId');
let pollTimer = null;

extensionIdEl.textContent = `ID: ${chrome.runtime.id}`;

function updateStatus(connected) {
  if (connected) {
    statusDot.className = 'connected';
    statusText.textContent = 'Connected';
  } else {
    statusDot.className = 'disconnected';
    statusText.textContent = 'Disconnected';
  }
}

function checkStatus() {
  chrome.runtime.sendMessage({ type: 'getStatus' }, (res) => {
    if (res) updateStatus(res.connected);
  });
}

function pollUntilConnected(attempts) {
  if (attempts <= 0) { checkStatus(); return; }
  pollTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'getStatus' }, (res) => {
      if (res && res.connected) { updateStatus(true); return; }
      pollUntilConnected(attempts - 1);
    });
  }, 1000);
}

checkStatus();

connectBtn.addEventListener('click', () => {
  statusDot.className = 'disconnected';
  statusText.textContent = 'Starting...';
  chrome.runtime.sendMessage({ type: 'connect', url: wsUrl.value });
  pollUntilConnected(10);
});

disconnectBtn.addEventListener('click', () => {
  clearTimeout(pollTimer);
  chrome.runtime.sendMessage({ type: 'disconnect' }, () => updateStatus(false));
});
