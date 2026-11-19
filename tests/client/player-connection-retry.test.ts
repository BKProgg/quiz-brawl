import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConnection, fakeWindow, flush, installBrowserFakes, removeBrowserFakes, startConnected } from './connection-fakes';

const RETRY_MILLISECONDS = 1500;
const FAILED_MESSAGE = '서버에 연결하지 못했습니다. 화면을 누르면 다시 시도합니다. 계속 안 되면 새로고침해 주세요.';

describe('PlayerConnection — 다시 붙기', () => {
  beforeEach(installBrowserFakes);
  afterEach(removeBrowserFakes);

  it('처음 연결에 실패해도 1.5초 뒤 다시 시도해 붙는다', async () => {
    const { connection, network, picker } = createConnection();
    network.shouldFail = true;
    connection.start();
    await flush();
    expect(network.connectCount).toBe(1);
    expect(picker.messages).toEqual(['연결하는 중…']);
    network.shouldFail = false;
    await vi.advanceTimersByTimeAsync(RETRY_MILLISECONDS);
    expect(network.connectCount).toBe(2);
    expect(picker.isConnected).toBe(true);
    expect(picker.messages.at(-1)).toBe('');
  });

  it('방 초기화 직후 연결에 실패해도 다시 시도해 붙고 안내한다', async () => {
    const { network, picker } = await startConnected();
    network.shouldFail = true;
    network.close('room reset');
    await flush();
    expect(network.connectCount).toBe(2);
    expect(picker.messages.at(-1)).toBe('연결이 끊겨 다시 붙는 중…');
    network.shouldFail = false;
    await vi.advanceTimersByTimeAsync(RETRY_MILLISECONDS);
    expect(network.connectCount).toBe(3);
    expect(picker.isConnected).toBe(true);
    expect(picker.messages.at(-1)).toContain('처음부터 다시 시작합니다');
  });

  it('게임 중 끊기면 1.5초 간격으로 최대 12번 다시 붙어 보고, 다 실패하면 안내만 남긴다', async () => {
    const { network, picker, onDisconnected } = await startConnected();
    network.shouldFail = true;
    network.close('');
    expect(picker.isConnected).toBe(false);
    expect(onDisconnected).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(RETRY_MILLISECONDS * 12);
    expect(network.connectCount).toBe(13);
    expect(picker.messages.at(-1)).toBe(FAILED_MESSAGE);
    await vi.advanceTimersByTimeAsync(RETRY_MILLISECONDS * 3);
    expect(network.connectCount).toBe(13);
  });

  it('다 실패한 뒤에도 화면을 누르면 다시 시도해 붙는다', async () => {
    const { network, picker } = await startConnected();
    network.shouldFail = true;
    network.close('');
    await vi.advanceTimersByTimeAsync(RETRY_MILLISECONDS * 12);
    network.shouldFail = false;
    fakeWindow.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(network.connectCount).toBe(14);
    expect(picker.isConnected).toBe(true);
    expect(picker.messages.at(-1)).toBe('');
  });

  it('다시 붙는 중에 온 close는 안내 문구를 덮어쓰지 않고, 붙고 나서 다시 끊기면 횟수를 새로 센다', async () => {
    const { network, picker, onDisconnected } = await startConnected();
    network.shouldFail = true;
    network.close('');
    await vi.advanceTimersByTimeAsync(RETRY_MILLISECONDS);
    network.close('');
    expect(onDisconnected).toHaveBeenCalledTimes(1);
    expect(picker.messages.at(-1)).toBe('연결이 끊겨 다시 붙는 중…');
    network.shouldFail = false;
    await vi.advanceTimersByTimeAsync(RETRY_MILLISECONDS);
    expect(picker.isConnected).toBe(true);
    expect(picker.messages.at(-1)).toBe('');
    network.shouldFail = true;
    network.close('');
    expect(onDisconnected).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(RETRY_MILLISECONDS * 12);
    expect(network.connectCount).toBe(3 + 12);
  });
});
