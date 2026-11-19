const POLICY_VIOLATION_CLOSE_CODE = 1008;
const RATE_LIMIT_WINDOW_MILLISECONDS = 1000;

export interface ClientSession {
  socket: WebSocket;
  playerId: string | null;
  isAdmin: boolean;
  messageCount: number;
  windowStartedAt: number;
  lastMessageAt: number;
}

export function createClientSession(socket: WebSocket, now: number): ClientSession {
  return { socket, playerId: null, isAdmin: false, messageCount: 0, windowStartedAt: now, lastMessageAt: now };
}

// 클라이언트는 2초마다(숨긴 탭은 메시지를 받을 때마다) ping을 보내므로, 그보다 한참 소식이 없으면 죽은 연결로 본다.
export function isSessionSilent(session: ClientSession, now: number, silenceMilliseconds: number): boolean {
  return hasJoined(session) && now - session.lastMessageAt >= silenceMilliseconds;
}

// 1초 단위로 받은 메시지 수를 세고, 한도를 넘었는지 돌려준다.
export function consumeRateLimit(session: ClientSession, now: number, maxMessagesPerSecond: number): boolean {
  session.lastMessageAt = now;
  if (now - session.windowStartedAt >= RATE_LIMIT_WINDOW_MILLISECONDS) {
    session.windowStartedAt = now;
    session.messageCount = 0;
  }
  session.messageCount += 1;
  return session.messageCount <= maxMessagesPerSecond;
}

// 입장한 플레이어나 관리자만 게임 상태를 받는다. 캐릭터 선택 화면(입장 전)은 명단만 받는다.
export function hasJoined(session: ClientSession): boolean {
  return session.playerId !== null || session.isAdmin;
}

export function sendToSession(session: ClientSession, payload: string): void {
  try {
    session.socket.send(payload);
  } catch {
    // 이미 닫힌 소켓이면 close 이벤트에서 정리되므로 무시한다.
  }
}

export function closeSessionSocket(session: ClientSession, reason: string): void {
  try {
    session.socket.close(POLICY_VIOLATION_CLOSE_CODE, reason);
  } catch {
    // 이미 닫히는 중인 소켓이면 무시하고 정리만 한다.
  }
}
