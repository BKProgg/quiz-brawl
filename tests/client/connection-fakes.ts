import type { CharacterPickerView } from '../../src/client/character-picker-view';
import type { NetworkClient } from '../../src/client/network-client';
import type { DisconnectInfo } from '../../src/client/player-connection';
import type { ClientMessage, ServerMessage } from '../../src/game/protocol-types';

import { vi } from 'vitest';

import { PlayerConnection } from '../../src/client/player-connection';

// NetworkClient 대역. close(reason)으로 서버가 끊은 상황을 흉내 낸다.
export class FakeNetwork {
  connectCount = 0;
  shouldFail = false;
  sent: ClientMessage[] = [];
  private onClose: ((reason: string) => void) | null = null;

  connect(_onMessage: (message: ServerMessage) => void, onClose: (reason: string) => void): Promise<void> {
    this.connectCount += 1;
    if (this.shouldFail) {
      return Promise.reject(new Error('fail'));
    }
    this.onClose = onClose;
    return Promise.resolve();
  }

  send(message: ClientMessage): void {
    this.sent.push(message);
  }

  close(reason: string): void {
    this.onClose?.(reason);
  }
}

// 캐릭터 선택 화면 대역. 안내 문구와 연결 상태만 기록한다.
export class FakePicker {
  messages: string[] = [];
  isConnected = false;

  showMessage(text: string): void {
    this.messages.push(text);
  }

  setConnected(isConnected: boolean): void {
    this.isConnected = isConnected;
  }
}

export const SESSION_KEY = 'quiz-brawl-session';
export const storage = new Map<string, string>();
export const fakeWindow = new EventTarget();
export const fakeDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' });

// 브라우저 전역(window·document·sessionStorage)과 타이머를 대역으로 바꾼다. 각 테스트 앞에서 부른다.
export function installBrowserFakes(): void {
  storage.clear();
  fakeDocument.visibilityState = 'visible';
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
}

export function removeBrowserFakes(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

export function createConnection(disconnectInfo: DisconnectInfo = { shouldKeepMessage: false }) {
  const network = new FakeNetwork();
  const picker = new FakePicker();
  const onConnected = vi.fn();
  const onDisconnected = vi.fn(() => disconnectInfo);
  const connection = new PlayerConnection(
    network as unknown as NetworkClient,
    picker as unknown as CharacterPickerView,
    { onMessage: vi.fn(), onConnected, onDisconnected },
  );
  return { connection, network, picker, onConnected, onDisconnected };
}

export async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

export async function startConnected() {
  const created = createConnection();
  created.connection.start();
  await flush();
  return created;
}
