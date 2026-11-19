import type { ServerMessage } from '../../src/game/protocol-types';
import type { ClientSession } from '../../src/server/client-session';

import { describe, expect, it } from 'vitest';

import { createEmptyInput } from '../../src/game/player-factory';
import { createClientSession } from '../../src/server/client-session';
import { handleRoomCommand } from '../../src/server/room-command-handler';
import { createController, getSnapshotPhase, getSnapshotPlayer } from './match-controller-helpers';

function createFakePort() {
  const controller = createController();
  const sent: ServerMessage[] = [];
  const broadcasts: ServerMessage[] = [];
  let resetCount = 0;
  const port = {
    getController: () => controller,
    send: (_session: ClientSession, message: ServerMessage) => sent.push(message),
    broadcast: (message: ServerMessage) => broadcasts.push(message),
    resetRoom: () => {
      resetCount += 1;
    },
  };
  return { controller, port, sent, broadcasts, getResetCount: () => resetCount };
}

function createPlayerSession(playerId: string): ClientSession {
  const session = createClientSession({} as WebSocket, 0);
  session.playerId = playerId;
  return session;
}

function createAdminSession(): ClientSession {
  const session = createClientSession({} as WebSocket, 0);
  session.isAdmin = true;
  return session;
}

describe('handleRoomCommand', () => {
  it('플레이어 입력은 해당 플레이어에게만 적용된다', () => {
    const room = createFakePort();
    room.controller.addPlayer('p1', '가', 0);
    handleRoomCommand(room.port, createPlayerSession('p1'), { type: 'input', ...createEmptyInput(), isRightPressed: true });
    handleRoomCommand(room.port, createAdminSession(), { type: 'input', ...createEmptyInput(), isLeftPressed: true });
    room.controller.tick(1 / 30, 0);
    expect(getSnapshotPlayer(room.controller, 'p1')?.facingSign).toBe(1);
  });

  it('게임 시작은 관리자만 할 수 있고 결과를 방송한다', () => {
    const room = createFakePort();
    room.controller.addPlayer('p1', '가', 0);
    handleRoomCommand(room.port, createPlayerSession('p1'), { type: 'start' });
    expect(getSnapshotPhase(room.controller)).toBe('lobby');
    handleRoomCommand(room.port, createAdminSession(), { type: 'start' });
    expect(getSnapshotPhase(room.controller)).toBe('intro');
    expect(room.broadcasts.map((message) => message.type)).toEqual(['question', 'zones']);
  });

  it('새 게임(초기화)은 관리자만 할 수 있다', () => {
    const room = createFakePort();
    handleRoomCommand(room.port, createPlayerSession('p1'), { type: 'newGame' });
    expect(room.getResetCount()).toBe(0);
    handleRoomCommand(room.port, createAdminSession(), { type: 'newGame' });
    expect(room.getResetCount()).toBe(1);
  });

  it('핑에는 같은 시각을 담아 바로 답한다', () => {
    const room = createFakePort();
    handleRoomCommand(room.port, createPlayerSession('p1'), { type: 'ping', clientTime: 42 });
    expect(room.sent).toEqual([{ type: 'pong', clientTime: 42 }]);
  });
});
