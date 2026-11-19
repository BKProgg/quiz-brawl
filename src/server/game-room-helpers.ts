import type { PlayerInput } from '../game/game-types';
import type { InputMessage } from '../game/protocol-types';
import type { ClientSession } from './client-session';

import { REPLACED_CLOSE_REASON, ROOM_RESET_CLOSE_REASON } from '../game/protocol-types';
import { closeSessionSocket } from './client-session';

// 방을 처음 상태로 되돌릴 때 플레이어 연결을 모두 내보낸다. 관리자 연결은 남긴다.
// 세션 목록에서 먼저 지우므로 늦게 오는 close가 새 방의 상태를 건드리지 않는다.
export function kickPlayerSessions(sessions: Map<string, ClientSession>): void {
  sessions.forEach((session, sessionId) => {
    if (session.playerId !== null) {
      session.playerId = null;
      sessions.delete(sessionId);
      closeSessionSocket(session, ROOM_RESET_CLOSE_REASON);
    }
  });
}

// 같은 자리로 복귀한 새 연결이 있을 때, 남아 있던 옛 연결을 플레이어와 분리해 끊는다.
// 세션 목록에서 먼저 지우므로 그 소켓의 늦은 close가 와도 플레이어는 제거되지 않는다.
export function detachSessionsOfPlayer(sessions: Map<string, ClientSession>, playerId: string): void {
  sessions.forEach((session, sessionId) => {
    if (session.playerId === playerId) {
      session.playerId = null;
      sessions.delete(sessionId);
      closeSessionSocket(session, REPLACED_CLOSE_REASON);
    }
  });
}

// 한동안 소식이 없는 연결의 플레이어를 모은다. 조용히 끊긴 사람의 캐릭터가 마지막 입력대로 계속 움직이지 않게 키를 떼는 데 쓴다.
export function findQuietPlayerIds(sessions: Map<string, ClientSession>, now: number, quietMilliseconds: number): string[] {
  return [...sessions.values()].flatMap((session) => {
    const isQuiet = now - session.lastMessageAt >= quietMilliseconds;
    return session.playerId !== null && isQuiet ? [session.playerId] : [];
  });
}

export function toPlayerInput(message: InputMessage): PlayerInput {
  const { type: _type, ...input } = message;
  return input;
}

// 한 번의 메시지 처리나 틱에서 예외가 새면 방 전체가 재시작되어 전원이 끊기므로, 기록만 남기고 계속 간다.
export function runGuarded(label: string, work: () => void): void {
  try {
    work();
  } catch (error) {
    console.error(`[GameRoom] ${label} failed`, error);
  }
}
