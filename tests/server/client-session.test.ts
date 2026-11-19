import { describe, expect, it, vi } from 'vitest';

import { closeSessionSocket, consumeRateLimit, createClientSession, sendToSession } from '../../src/server/client-session';

function createFakeSocket(shouldThrow = false) {
  const fail = () => {
    if (shouldThrow) {
      throw new Error('closed');
    }
  };
  return { send: vi.fn(fail), close: vi.fn(fail) } as unknown as WebSocket;
}

describe('consumeRateLimit', () => {
  it('1초 안에 한도까지는 허용하고 넘으면 거부한다', () => {
    const session = createClientSession(createFakeSocket(), 0);
    expect(consumeRateLimit(session, 10, 2)).toBe(true);
    expect(consumeRateLimit(session, 20, 2)).toBe(true);
    expect(consumeRateLimit(session, 30, 2)).toBe(false);
  });

  it('1초가 지나면 다시 센다', () => {
    const session = createClientSession(createFakeSocket(), 0);
    consumeRateLimit(session, 10, 1);
    expect(consumeRateLimit(session, 1000, 1)).toBe(true);
  });
});

describe('소켓 보내기·닫기', () => {
  it('정상 소켓에는 그대로 보내고 닫는다', () => {
    const socket = createFakeSocket();
    const session = createClientSession(socket, 0);
    sendToSession(session, 'payload');
    closeSessionSocket(session, 'reason');
    expect(socket.send).toHaveBeenCalledWith('payload');
    expect(socket.close).toHaveBeenCalledWith(1008, 'reason');
  });

  it('이미 닫힌 소켓에서 예외가 나도 밖으로 던지지 않는다', () => {
    const session = createClientSession(createFakeSocket(true), 0);
    expect(() => sendToSession(session, 'payload')).not.toThrow();
    expect(() => closeSessionSocket(session, 'reason')).not.toThrow();
  });
});
