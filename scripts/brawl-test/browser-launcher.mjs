// 헤드리스 Chrome을 띄우고, 창마다 따로 떨어진 프로필(시크릿 창과 같음)로 페이지를 연다.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

import { BrowserPage, sleep } from './browser-page.mjs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FRAME_COUNTER = 'window.__frameCount=0;(function loop(){window.__frameCount+=1;requestAnimationFrame(loop);})();';
// 소켓이 닫힐 때의 코드(1000 정상, 1006 비정상 종료, 1008 서버가 끊음)를 콘솔에 남긴다.
const CLOSE_CODE_LOGGER = 'const Original=window.WebSocket;window.WebSocket=class extends Original{constructor(...args){super(...args);' +
  "this.addEventListener('close',(event)=>console.info('[connection] code '+event.code+(event.wasClean?' clean':' unclean')));}};";
const CHROME_FLAGS = [
  '--headless=new', '--window-size=1280,800', '--no-first-run', '--mute-audio',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
];

async function waitForDevTools(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(250);
    try {
      return await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch { /* 뜨는 중 */ }
  }
  throw new Error('Chrome이 뜨지 않았습니다.');
}

export async function launchBrowser(profileDirectory, port) {
  rmSync(profileDirectory, { recursive: true, force: true });
  const chromeArguments = [...CHROME_FLAGS, `--remote-debugging-port=${port}`, `--user-data-dir=${profileDirectory}`, 'about:blank'];
  const chrome = spawn(CHROME_PATH, chromeArguments, { stdio: 'ignore' });
  const version = await waitForDevTools(port);
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve));
  const pending = new Map();
  const pages = new Map();
  let nextId = 1;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        waiter?.reject(new Error(message.error.message));
      } else {
        waiter?.resolve(message.result);
      }
      return;
    }
    pages.get(message.sessionId)?.handleEvent(message.method, message.params);
  });
  const browser = {
    send(method, params = {}, sessionId = undefined) {
      return new Promise((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
    async openPage(url, label) {
      const { browserContextId } = await browser.send('Target.createBrowserContext');
      const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
      const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
      const page = new BrowserPage(browser, label, sessionId, targetId);
      pages.set(sessionId, page);
      await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable'].map((method) => page.send(method)));
      await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
      await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await page.send('Page.addScriptToEvaluateOnNewDocument', { source: FRAME_COUNTER + CLOSE_CODE_LOGGER });
      await page.send('Page.navigate', { url });
      return page;
    },
    close() {
      socket.close();
      chrome.kill();
    },
  };
  return browser;
}
