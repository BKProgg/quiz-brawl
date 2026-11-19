import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NetworkClient } from '../../src/client/network-client';
import { FakeWebSocket as FakeSocket } from './fake-web-socket';

let now = 0;

// 타이머와 시계를 함께 1초씩 흘려, 매 초 점검이 그 시각을 보게 한다.
function advance(milliseconds: number): void {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 1000) {
    const step = Math.min(1000, milliseconds - elapsed);
    now += step;
    vi.advanceTimersByTime(step);
  }
}

function connect(client: NetworkClient) {
  const onMessage = vi.fn();
  const onClose = vi.fn();
  const promise = client.connect(onMessage, onClose);
  const socket = FakeSocket.instances.at(-1) as FakeSocket;
  return { promise, socket, onMessage, onClose };
}

async function connectAndOpen(client: NetworkClient) {
  const connection = connect(client);
  connection.socket.open();
  await connection.promise;
  return connection;
}

describe('NetworkClient', () => {
  beforeEach(() => {
    now = 0;
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('location', { protocol: 'https:', host: 'quiz.example' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('https 페이지에서는 wss, http 페이지에서는 ws로 붙고, 열리기 전에는 보내지 않는다', async () => {
    const client = new NetworkClient();
    const { promise, socket } = connect(client);
    client.send({ type: 'ping', clientTime: 0 });
    expect(socket.url).toBe('wss://quiz.example/ws');
    expect(socket.sent).toEqual([]);
    socket.open();
    await promise;
    client.send({ type: 'ping', clientTime: 0 });
    expect(socket.sentTypes()).toEqual(['ping']);
    vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:8787' });
    expect(connect(new NetworkClient()).socket.url).toBe('ws://localhost:8787/ws');
  });

  it('연결되면 2초마다 핑을 보낸다', async () => {
    const { socket } = await connectAndOpen(new NetworkClient());
    advance(1000);
    expect(socket.sentTypes()).toEqual([]);
    advance(1000);
    expect(socket.sentTypes()).toEqual(['ping']);
    advance(2000);
    expect(socket.sentTypes()).toEqual(['ping', 'ping']);
  });

  it('타이머가 늦어져도 메시지를 받으면 밀린 핑을 바로 보낸다', async () => {
    const { socket, onMessage } = await connectAndOpen(new NetworkClient());
    now = 2500;
    socket.receive({ type: 'roster', players: [] });
    expect(socket.sentTypes()).toEqual(['ping']);
    expect(onMessage).toHaveBeenCalledWith({ type: 'roster', players: [] });
    socket.receive({ type: 'roster', players: [] });
    expect(socket.sentTypes()).toEqual(['ping']);
  });

  it('핑 응답으로 왕복 시간을 부드럽게 갱신하고 게임 쪽에는 넘기지 않는다', async () => {
    const client = new NetworkClient();
    const { socket, onMessage } = await connectAndOpen(client);
    now = 100;
    socket.receive({ type: 'pong', clientTime: 0 });
    expect(client.getRoundTripMilliseconds()).toBeCloseTo(84);
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('8초 넘게 서버 소식이 없으면 연결을 버리고, 그 소켓의 늦은 close·message는 무시한다', async () => {
    const { socket, onClose, onMessage } = await connectAndOpen(new NetworkClient());
    advance(8000);
    expect(onClose).not.toHaveBeenCalled();
    advance(1000);
    expect(socket.closeCount).toBe(1);
    expect(onClose).toHaveBeenCalledWith('');
    socket.emit('close', { reason: 'late' });
    socket.receive({ type: 'roster', players: [] });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('입장 전 화면처럼 핑 응답만 와도 끊지 않는다', async () => {
    const { socket, onClose } = await connectAndOpen(new NetworkClient());
    for (let second = 0; second < 30; second += 1) {
      advance(1000);
      const lastPing = socket.sent.at(-1);
      if (lastPing !== undefined && (JSON.parse(lastPing) as { clientTime: number }).clientTime === now) {
        socket.receive({ type: 'pong', clientTime: now });
      }
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it('점검이 한참 늦게 돌면(탭 숨김·화면 멈춤) 그동안의 공백은 끊김으로 보지 않는다', async () => {
    const { socket, onClose } = await connectAndOpen(new NetworkClient());
    now += 60_000;
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
    expect(socket.sentTypes()).toEqual(['ping']);
    advance(9000);
    expect(onClose).toHaveBeenCalledWith('');
  });

  it('서버가 끊으면 사유를 전달하고 감시를 멈춘다', async () => {
    const { socket, onClose } = await connectAndOpen(new NetworkClient());
    socket.emit('close', { reason: 'join timeout' });
    expect(onClose).toHaveBeenCalledWith('join timeout');
    advance(10_000);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(socket.sentTypes()).toEqual([]);
  });

  it('열리기 전에 실패하면 거부만 하고 onClose는 부르지 않는다', async () => {
    const { promise, socket, onClose } = connect(new NetworkClient());
    socket.emit('error', {});
    socket.emit('close', { reason: '' });
    await expect(promise).rejects.toThrow('서버에 연결하지 못했습니다.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('4초 안에 열리지 않으면 그 시도를 닫고 거부하며, 그 소켓의 늦은 error는 무시한다', async () => {
    const { promise, socket, onClose } = connect(new NetworkClient());
    const rejection = expect(promise).rejects.toThrow('서버에 연결하지 못했습니다.');
    advance(3000);
    expect(socket.closeCount).toBe(0);
    advance(1000);
    expect(socket.closeCount).toBe(1);
    await rejection;
    socket.emit('error', {});
    socket.emit('close', { reason: '' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('제때 열린 연결은 시간 제한으로 닫지 않는다', async () => {
    const { socket, onClose } = await connectAndOpen(new NetworkClient());
    advance(4000);
    expect(socket.closeCount).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('더 새 소켓이 생긴 뒤 늦게 열린 옛 소켓은 닫고 쓰지 않는다', async () => {
    const client = new NetworkClient();
    const first = connect(client);
    const second = connect(client);
    first.socket.open();
    expect(first.socket.closeCount).toBe(1);
    second.socket.open();
    await second.promise;
    client.send({ type: 'ping', clientTime: 0 });
    expect(first.socket.sent).toEqual([]);
    expect(second.socket.sentTypes()).toEqual(['ping']);
    // 밀려난 옛 소켓의 시간 제한도 풀려 있어 나중에 다시 닫지 않는다.
    advance(4000);
    expect(first.socket.closeCount).toBe(1);
  });

  it('dropConnection은 연결이 없으면 아무것도 하지 않고, close가 실패해도 정리한다', async () => {
    const client = new NetworkClient();
    expect(() => client.dropConnection()).not.toThrow();
    const { socket, onClose } = await connectAndOpen(client);
    socket.close = () => {
      throw new Error('already closed');
    };
    client.dropConnection();
    expect(onClose).toHaveBeenCalledWith('');
  });
});
