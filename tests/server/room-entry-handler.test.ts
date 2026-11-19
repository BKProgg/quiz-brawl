import type { ServerMessage } from '../../src/game/protocol-types';
import type { ClientSession } from '../../src/server/client-session';

import { describe, expect, it } from 'vitest';

import { createClientSession } from '../../src/server/client-session';
import { RoomEntryHandler } from '../../src/server/room-entry-handler';
import { createController } from './match-controller-helpers';

// 소켓 없이 입장 처리만 검증하기 위한 가짜 방
function createFakeRoom() {
  const controller = createController();
  const sent: { session: ClientSession; message: ServerMessage }[] = [];
  const broadcasts: ServerMessage[] = [];
  const rejected: string[] = [];
  const detached: string[] = [];
  let tokenNumber = 0;
  let isTickerStarted = false;
  const handler = new RoomEntryHandler({
    getController: () => controller,
    send: (session, message) => sent.push({ session, message }),
    broadcast: (message) => broadcasts.push(message),
    reject: (sessionId, session, reason) => {
      rejected.push(reason);
      sent.push({ session, message: { type: 'rejected', reason } });
    },
    detachSessionsOfPlayer: (playerId) => detached.push(playerId),
    startTicker: () => {
      isTickerStarted = true;
    },
    createToken: () => `token-${(tokenNumber += 1)}`,
  });
  return { controller, handler, sent, broadcasts, rejected, detached, isTickerStarted: () => isTickerStarted };
}

function createSession(): ClientSession {
  return createClientSession({} as WebSocket, 0);
}

function findSent(sent: { session: ClientSession; message: ServerMessage }[], session: ClientSession, type: ServerMessage['type']) {
  return sent.filter((entry) => entry.session === session && entry.message.type === type).map((entry) => entry.message);
}

function joinPlayer(room: ReturnType<typeof createFakeRoom>, sessionId: string, colorIndex: number) {
  const session = createSession();
  room.handler.handle(sessionId, session, { type: 'join', nickname: '가나', colorIndex });
  const welcome = findSent(room.sent, session, 'welcome')[0];
  return { session, resumeToken: welcome?.type === 'welcome' ? welcome.resumeToken : '' };
}

describe('RoomEntryHandler — 입장', () => {
  it('입장하면 welcome(복귀 토큰 포함)·동기화·명단을 보내고 틱을 켠다', () => {
    const room = createFakeRoom();
    const { session, resumeToken } = joinPlayer(room, 's1', 0);
    expect(session.playerId).toBe('s1');
    expect(resumeToken).toBe('token-1');
    expect(findSent(room.sent, session, 'question')).toHaveLength(1);
    expect(room.broadcasts.map((message) => message.type)).toEqual(['roster']);
    expect(room.isTickerStarted()).toBe(true);
  });

  it('이미 입장한 연결의 입장 요청은 무시한다', () => {
    const room = createFakeRoom();
    const { session } = joinPlayer(room, 's1', 0);
    room.handler.handle('s1', session, { type: 'join', nickname: '다시', colorIndex: 1 });
    expect(room.controller.isColorAvailable(1)).toBe(true);
  });

  it('빈 닉네임과 사용 중인 색은 연결을 유지한 채 거절한다', () => {
    const room = createFakeRoom();
    joinPlayer(room, 's1', 0);
    const session = createSession();
    room.handler.handle('s2', session, { type: 'join', nickname: '   ', colorIndex: 1 });
    room.handler.handle('s2', session, { type: 'join', nickname: '나', colorIndex: 0 });
    const reasons = findSent(room.sent, session, 'rejected').map((message) => message.type === 'rejected' && message.reason);
    expect(reasons).toEqual(['invalidNickname', 'colorTaken']);
    expect(session.playerId).toBeNull();
    expect(room.rejected).toEqual([]);
  });

  it('방이 가득 차면 끊는 거절을 한다', () => {
    const room = createFakeRoom();
    for (let index = 0; index < 10; index += 1) {
      joinPlayer(room, `s${index}`, index);
    }
    joinPlayer(room, 'late', 11);
    expect(room.rejected).toEqual(['roomFull']);
  });

  it('관리자는 adminWelcome과 명단을 받고 틱을 켠다', () => {
    const room = createFakeRoom();
    const session = createSession();
    room.handler.handle('admin', session, { type: 'adminJoin' });
    expect(session.isAdmin).toBe(true);
    expect(findSent(room.sent, session, 'adminWelcome')).toHaveLength(1);
    expect(findSent(room.sent, session, 'roster')).toHaveLength(1);
    expect(room.isTickerStarted()).toBe(true);
  });
});

describe('RoomEntryHandler — 복귀', () => {
  it('토큰이 맞으면 옛 연결을 떼어 내고 새 연결에 자리를 넘기며, 토큰은 그대로 둔다', () => {
    const room = createFakeRoom();
    const { resumeToken } = joinPlayer(room, 's1', 0);
    const newSession = createSession();
    room.handler.handle('s2', newSession, { type: 'resume', playerId: 's1', resumeToken });
    expect(newSession.playerId).toBe('s1');
    expect(room.detached).toEqual(['s1']);
    const welcome = findSent(room.sent, newSession, 'welcome')[0];
    expect(welcome?.type === 'welcome' && welcome.resumeToken).toBe(resumeToken);
    // 복귀 응답을 못 받고 다시 끊긴 탭도 같은 토큰으로 돌아올 수 있다.
    const thirdSession = createSession();
    room.handler.handle('s3', thirdSession, { type: 'resume', playerId: 's1', resumeToken });
    expect(thirdSession.playerId).toBe('s1');
  });

  it('토큰이 틀리면 거절만 하고 주인의 토큰은 그대로 둔다', () => {
    const room = createFakeRoom();
    const { resumeToken } = joinPlayer(room, 's1', 0);
    const attacker = createSession();
    room.handler.handle('s2', attacker, { type: 'resume', playerId: 's1', resumeToken: 'wrong' });
    expect(attacker.playerId).toBeNull();
    expect(findSent(room.sent, attacker, 'rejected')).toHaveLength(1);
    expect(room.detached).toEqual([]);
    const owner = createSession();
    room.handler.handle('s3', owner, { type: 'resume', playerId: 's1', resumeToken });
    expect(owner.playerId).toBe('s1');
  });

  it('토큰은 맞지만 유예가 지나 자리가 없으면 거절하고 토큰을 지운다', () => {
    const room = createFakeRoom();
    const { resumeToken } = joinPlayer(room, 's1', 0);
    room.controller.removePlayer('s1', 0);
    const session = createSession();
    room.handler.handle('s2', session, { type: 'resume', playerId: 's1', resumeToken });
    expect(session.playerId).toBeNull();
    const reason = findSent(room.sent, session, 'rejected')[0];
    expect(reason?.type === 'rejected' && reason.reason).toBe('resumeExpired');
  });

  it('새 방이 되면 이전 토큰을 모두 버린다', () => {
    const room = createFakeRoom();
    const { resumeToken } = joinPlayer(room, 's1', 0);
    room.handler.clearTokens();
    const session = createSession();
    room.handler.handle('s2', session, { type: 'resume', playerId: 's1', resumeToken });
    expect(session.playerId).toBeNull();
  });
});
