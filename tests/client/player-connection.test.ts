import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SESSION_KEY, createConnection, fakeDocument, fakeWindow, flush, installBrowserFakes, removeBrowserFakes, startConnected, storage,
} from './connection-fakes';

const REMEMBERED_SESSION = JSON.stringify({ playerId: 'p1', resumeToken: 't1' });

describe('PlayerConnection — 접속과 끊김 사유', () => {
  beforeEach(installBrowserFakes);
  afterEach(removeBrowserFakes);

  it('붙으면 선택 화면을 열고, 기억한 자리가 없으면 복귀 요청을 보내지 않는다', async () => {
    const { connection, network, picker, onConnected } = await startConnected();
    expect(picker.isConnected).toBe(true);
    expect(picker.messages).toEqual(['연결하는 중…', '']);
    expect(network.sent).toEqual([]);
    expect(onConnected).toHaveBeenCalledTimes(1);
    expect(connection.takeResumeFlag()).toBe(false);
  });

  it('기억한 자리가 있으면 복귀 요청을 보내고 복귀 표시는 한 번만 읽힌다', async () => {
    storage.set(SESSION_KEY, REMEMBERED_SESSION);
    const { connection, network } = await startConnected();
    expect(network.sent).toEqual([{ type: 'resume', playerId: 'p1', resumeToken: 't1' }]);
    expect(connection.takeResumeFlag()).toBe(true);
    expect(connection.takeResumeFlag()).toBe(false);
  });

  it('다른 탭에 자리를 넘겨 끊기면 자리를 잊고 다시 붙지 않는다', async () => {
    storage.set(SESSION_KEY, REMEMBERED_SESSION);
    const { network, picker } = await startConnected();
    network.close('replaced by reconnect');
    await vi.advanceTimersByTimeAsync(5000);
    expect(storage.has(SESSION_KEY)).toBe(false);
    expect(picker.isConnected).toBe(false);
    expect(picker.messages.at(-1)).toContain('다른 탭에서 같은 자리로');
    expect(network.connectCount).toBe(1);
  });

  it('관리자가 방을 초기화하면 자리를 잊고 바로 다시 붙어 안내한다', async () => {
    storage.set(SESSION_KEY, REMEMBERED_SESSION);
    const { network, picker } = await startConnected();
    network.sent.length = 0;
    network.close('room reset');
    await flush();
    expect(storage.has(SESSION_KEY)).toBe(false);
    expect(network.connectCount).toBe(2);
    expect(network.sent).toEqual([]);
    expect(picker.isConnected).toBe(true);
    expect(picker.messages.at(-1)).toContain('처음부터 다시 시작합니다');
  });

  it('방이 가득 차서 끊기면 그 안내를 남기고 다시 붙지 않는다', async () => {
    const { connection, network, picker } = createConnection({ shouldKeepMessage: true });
    connection.start();
    await flush();
    network.close('roomFull');
    await vi.advanceTimersByTimeAsync(5000);
    expect(network.connectCount).toBe(1);
    expect(picker.messages).toEqual(['연결하는 중…', '']);
  });

  it('선택 화면에 오래 머물러 끊기면 바로 붙지 않고, 화면을 누르면 다시 붙는다', async () => {
    const { network, picker } = await startConnected();
    network.close('join timeout');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(network.connectCount).toBe(1);
    expect(picker.isConnected).toBe(false);
    expect(picker.messages.at(-1)).toContain('화면을 누르면');
    fakeWindow.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(network.connectCount).toBe(2);
    expect(picker.isConnected).toBe(true);
    fakeWindow.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(network.connectCount).toBe(2);
  });

  it('숨겨진 탭은 보이게 될 때 다시 붙는다', async () => {
    const { network } = await startConnected();
    network.close('join timeout');
    fakeDocument.visibilityState = 'hidden';
    fakeWindow.dispatchEvent(new Event('keydown'));
    await flush();
    expect(network.connectCount).toBe(1);
    fakeDocument.visibilityState = 'visible';
    fakeWindow.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(network.connectCount).toBe(2);
  });
});
