import type { ClientSession } from '../../src/server/client-session';

import { describe, expect, it } from 'vitest';

import { REPLACED_CLOSE_REASON, ROOM_RESET_CLOSE_REASON } from '../../src/game/protocol-types';
import { createClientSession } from '../../src/server/client-session';
import { detachSessionsOfPlayer, findQuietPlayerIds, kickPlayerSessions } from '../../src/server/game-room-helpers';

// 닫힌 사유만 기록하는 가짜 소켓
function createSession(playerId: string | null, isAdmin = false): { session: ClientSession; closed: string[] } {
  const closed: string[] = [];
  const socket = { close: (_code: number, reason: string) => closed.push(reason) } as unknown as WebSocket;
  const session = createClientSession(socket, 0);
  session.playerId = playerId;
  session.isAdmin = isAdmin;
  return { session, closed };
}

describe('kickPlayerSessions', () => {
  it('플레이어 연결만 방 초기화 사유로 끊고 목록에서 지운다. 관리자와 입장 전 연결은 남긴다', () => {
    const player = createSession('p1');
    const admin = createSession(null, true);
    const pending = createSession(null);
    const sessions = new Map<string, ClientSession>([['s1', player.session], ['s2', admin.session], ['s3', pending.session]]);
    kickPlayerSessions(sessions);
    expect([...sessions.keys()]).toEqual(['s2', 's3']);
    expect(player.closed).toEqual([ROOM_RESET_CLOSE_REASON]);
    expect(player.session.playerId).toBeNull();
    expect(admin.closed).toEqual([]);
    expect(pending.closed).toEqual([]);
  });
});

describe('detachSessionsOfPlayer', () => {
  it('해당 플레이어의 연결만 교체 사유로 끊고 플레이어와 분리한다', () => {
    const old = createSession('p1');
    const other = createSession('p2');
    const sessions = new Map<string, ClientSession>([['s1', old.session], ['s2', other.session]]);
    detachSessionsOfPlayer(sessions, 'p1');
    expect([...sessions.keys()]).toEqual(['s2']);
    expect(old.closed).toEqual([REPLACED_CLOSE_REASON]);
    expect(old.session.playerId).toBeNull();
    expect(other.closed).toEqual([]);
  });
});

describe('findQuietPlayerIds', () => {
  it('기준 시간 넘게 소식이 없는 플레이어만 고르고, 관리자와 입장 전 연결은 고르지 않는다', () => {
    const quiet = createSession('p1');
    const active = createSession('p2');
    active.session.lastMessageAt = 9000;
    const admin = createSession(null, true);
    const sessions = new Map<string, ClientSession>([['s1', quiet.session], ['s2', active.session], ['s3', admin.session]]);
    expect(findQuietPlayerIds(sessions, 9999, 10_000)).toEqual([]);
    expect(findQuietPlayerIds(sessions, 10_000, 10_000)).toEqual(['p1']);
  });
});
