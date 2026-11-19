// capture_screenshots.mjs — takes the entry's four screenshots for real.
//
// Serves app/ locally, drives the Playwright chromium headless shell over
// CDP, and for each of the three compositions asks the app itself for its
// exported PNG (the same bytes its Export button writes), plus one editor
// capture with the samples loaded and a finished cover composed. Raw
// captures land in tools/shots-raw/; tools/fit_screenshots.py then scales
// and palette-fits them into screenshots/ inside the gate's limits.
//
//   node tools/capture_screenshots.mjs

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = fileURLToPath(new URL('..', import.meta.url));
const rawDir = join(repoDir, 'tools', 'shots-raw');
mkdirSync(rawDir, { recursive: true });

const PORT = 8091;
const CDP_PORT = 9333;
const CHROME = join(
  homedir(),
  '.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell',
);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch { /* not up yet */ }
    await wait(250);
  }
  throw new Error(`never came up: ${url}`);
}

// A minimal CDP client over the built-in WebSocket, bound to one page
// target through that target's own debugger URL (no session juggling).
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });
  }

  static async connectToPage(port) {
    await waitForHttp(`http://127.0.0.1:${port}/json/version`);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((target) => target.type === 'page');
    if (!page) throw new Error('no page target in the headless shell');
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new Cdp(socket);
  }

  call(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`page error: ${JSON.stringify(result.exceptionDetails).slice(0, 400)}`);
    }
    return result.result.value;
  }
}

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repoDir, stdio: 'ignore' });
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=1680,920',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/`);
    const cdp = await Cdp.connectToPage(CDP_PORT);
    const call = (method, params) => cdp.call(method, params);
    const evaluate = (expression) => cdp.evaluate(expression);
    await call('Page.enable');
    await call('Runtime.enable');
    await call('Emulation.setDeviceMetricsOverride', {
      width: 1680, height: 920, deviceScaleFactor: 1, mobile: false,
    });
    await call('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    // Wait for the studio API, its samples and its fonts.
    for (let i = 0; i < 80; i += 1) {
      const ready = await evaluate(`Boolean(window.__sunsetPress) && document.fonts.status === 'loaded'`);
      if (ready) break;
      await wait(250);
    }
    await evaluate(`window.__sunsetPress.applyComposition(0)`);
    await wait(600);

    const saveDataUrl = async (dataUrl, name) => {
      const base64 = dataUrl.split(',')[1];
      writeFileSync(join(rawDir, name), Buffer.from(base64, 'base64'));
      console.log('captured', name);
    };

    // 1 — the exported wide cover (composition 1 at its own size).
    await saveDataUrl(await evaluate(`window.__sunsetPress.exportDataURL('wide')`), '1-cover-wide.png');
    // 2 — the editor, samples loaded, finished cover composed, no outline.
    await evaluate(`window.__sunsetPress.clearSelection()`);
    await wait(300);
    const editorShot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(rawDir, '2-editor.png'), Buffer.from(editorShot.data, 'base64'));
    console.log('captured 2-editor.png');
    // 3 — the exported portrait cover (composition 2).
    await evaluate(`window.__sunsetPress.applyComposition(1)`);
    await wait(400);
    await saveDataUrl(await evaluate(`window.__sunsetPress.exportDataURL('portrait')`), '3-cover-portrait.png');
    // 4 — the exported square cover (composition 3).
    await evaluate(`window.__sunsetPress.applyComposition(2)`);
    await wait(400);
    await saveDataUrl(await evaluate(`window.__sunsetPress.exportDataURL('square')`), '4-cover-square.png');
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
