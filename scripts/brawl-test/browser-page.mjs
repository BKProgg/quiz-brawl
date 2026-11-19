// Chrome DevTools 프로토콜로 조종하는 페이지 하나. 콘솔 오류·소켓 사건·받은 메시지를 기록하고, 키보드·마우스 입력과 캡처를 제공한다.
import { writeFileSync } from 'node:fs';

const KEYS = {
  ArrowUp: { key: 'ArrowUp', virtualKey: 38 },
  ArrowDown: { key: 'ArrowDown', virtualKey: 40 },
  ArrowLeft: { key: 'ArrowLeft', virtualKey: 37 },
  ArrowRight: { key: 'ArrowRight', virtualKey: 39 },
  KeyZ: { key: 'z', virtualKey: 90 },
  KeyX: { key: 'x', virtualKey: 88 },
  KeyC: { key: 'c', virtualKey: 67 },
  Escape: { key: 'Escape', virtualKey: 27 },
};

export const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class BrowserPage {
  constructor(browser, label, sessionId, targetId) {
    Object.assign(this, { browser, label, sessionId, targetId });
    Object.assign(this, { errors: [], dialogs: [], messages: [], received: {}, connectionEvents: [], heldKeys: new Set() });
    Object.assign(this, { socketsCreated: 0, socketsClosed: 0, snapshotCount: 0, sentCount: 0, welcomeCount: 0, playerId: null });
    this.isClosed = false;
    this.startedAt = Date.now();
  }

  note(text) {
    this.connectionEvents.push(`${((Date.now() - this.startedAt) / 1000).toFixed(1)}s ${text}`);
  }

  send(method, params = {}) {
    return this.isClosed ? Promise.resolve(null) : this.browser.send(method, params, this.sessionId).catch(() => null);
  }

  handleEvent(method, params) {
    if (method === 'Runtime.consoleAPICalled' && String(params.args[0]?.value).startsWith('[connection]')) {
      this.note(String(params.args[0].value));
    }
    if (method === 'Runtime.exceptionThrown') {
      this.errors.push(`exception: ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`);
    } else if (method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(params.type)) {
      this.errors.push(`console.${params.type}: ${params.args.map((argument) => argument.value ?? argument.description).join(' ')}`);
    } else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
      this.errors.push(`log: ${params.entry.text} ${params.entry.url ?? ''}`);
    } else if (method === 'Network.webSocketCreated') {
      this.socketsCreated += 1;
      this.note('소켓 생성');
    } else if (method === 'Network.webSocketClosed') {
      this.socketsClosed += 1;
      this.note('소켓 닫힘');
    } else if (method === 'Network.webSocketFrameSent') {
      this.sentCount += 1;
    } else if (method === 'Network.webSocketFrameReceived') {
      this.handleFrame(params.response.payloadData);
    } else if (method === 'Page.javascriptDialogOpening') {
      this.dialogs.push(params.message);
      this.send('Page.handleJavaScriptDialog', { accept: true });
    }
  }

  handleFrame(payload) {
    if (payload.startsWith('{"type":"snapshot"')) {
      this.snapshotCount += 1;
      return;
    }
    const message = JSON.parse(payload);
    this.received[message.type] = (this.received[message.type] ?? 0) + 1;
    if (message.type === 'welcome') {
      this.playerId = message.playerId;
      this.welcomeCount += 1;
    }
    if (message.type !== 'pong' && message.type !== 'roster') {
      this.messages.push(message);
    }
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return result?.result?.value;
  }

  key(type, code) {
    const { key, virtualKey } = KEYS[code];
    return this.send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
  }

  tap(code, holdMilliseconds = 40) {
    this.key('rawKeyDown', code);
    setTimeout(() => this.key('keyUp', code), holdMilliseconds);
  }

  // 원하는 키 집합과 지금 눌린 키 집합의 차이만 보낸다.
  holdKeys(wanted) {
    [...this.heldKeys].filter((code) => !wanted.has(code)).forEach((code) => {
      this.heldKeys.delete(code);
      this.key('keyUp', code);
    });
    [...wanted].filter((code) => !this.heldKeys.has(code)).forEach((code) => {
      this.heldKeys.add(code);
      this.key('rawKeyDown', code);
    });
  }

  async locate(selector) {
    const rect = await this.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;` +
      'const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:!!e.disabled,hidden:r.width===0};})()');
    return rect && !rect.disabled && !rect.hidden ? rect : null;
  }

  async clickAt(point) {
    const base = { x: point.x, y: point.y, button: 'left', clickCount: 1 };
    await this.send('Input.dispatchMouseEvent', { ...base, type: 'mousePressed' });
    await this.send('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' });
  }

  async click(selector) {
    const point = await this.locate(selector);
    if (point === null) {
      return false;
    }
    await this.clickAt(point);
    return true;
  }

  async screenshot(path) {
    const result = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    if (result?.data) {
      writeFileSync(path, Buffer.from(result.data, 'base64'));
    }
  }

  async close() {
    this.isClosed = true;
    await this.browser.send('Target.closeTarget', { targetId: this.targetId }).catch(() => null);
  }
}
