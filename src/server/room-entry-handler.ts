import type { AdminJoinMessage, JoinMessage, RejectReason, ResumeMessage, ServerMessage } from '../game/protocol-types';
import type { ClientSession } from './client-session';
import type { MatchController } from './match-controller';

import { GAME_CONFIG } from '../game/game-config';
import { hasJoined } from './client-session';
import { sanitizeNickname } from './message-parser';

// 입장 처리가 방(GameRoom)에서 필요로 하는 것들
export interface RoomPort {
  getController(): MatchController;
  send(session: ClientSession, message: ServerMessage): void;
  broadcast(message: ServerMessage): void;
  reject(sessionId: string, session: ClientSession, reason: RejectReason): void;
  detachSessionsOfPlayer(playerId: string): void;
  startTicker(): void;
  createToken(): string;
}

// 플레이어 입장(캐릭터 선택), 관리자 입장, 끊긴 뒤 복귀를 처리한다.
// 복귀 토큰은 입장할 때 만들어 본인에게만 보내고, 같은 토큰을 가져온 연결에만 자리를 돌려준다.
// 복귀해도 토큰은 그대로 둔다. 바꾼 토큰이 담긴 응답을 받기 전에 다시 끊기면 그 자리로 돌아올 수 없게 되기 때문이다.
export class RoomEntryHandler {
  private readonly resumeTokens = new Map<string, string>();

  constructor(private readonly room: RoomPort) {}

  handle(sessionId: string, session: ClientSession, message: JoinMessage | AdminJoinMessage | ResumeMessage): void {
    if (hasJoined(session)) {
      return;
    }
    if (message.type === 'adminJoin') {
      this.admitAdmin(session);
    } else if (message.type === 'resume') {
      this.resumePlayer(session, message);
    } else {
      this.admitPlayer(sessionId, session, message);
    }
  }

  // 방이 새로 만들어지면(전원 퇴장) 이전 방의 토큰은 모두 버린다.
  clearTokens(): void {
    this.resumeTokens.clear();
  }

  private admitAdmin(session: ClientSession): void {
    const controller = this.room.getController();
    session.isAdmin = true;
    this.room.send(session, { type: 'adminWelcome', config: GAME_CONFIG });
    controller.buildSyncMessages().forEach((outgoing) => this.room.send(session, outgoing));
    this.room.send(session, controller.buildRosterMessage());
    this.room.startTicker();
  }

  // 새로고침이나 잠깐 끊김 뒤 같은 id와 토큰으로 돌아오면 캐릭터·점수 그대로 복귀시킨다. 유예가 지났으면 다시 고르게 한다.
  // 토큰이 틀린 요청은 거절만 한다(남의 토큰을 지워 복귀를 방해하지 못하게).
  // 서버가 끊김을 아직 모르는 옛 연결이 남아 있으면 그 연결을 끊고 새 연결에 자리를 넘긴다.
  private resumePlayer(session: ClientSession, message: ResumeMessage): void {
    const { playerId } = message;
    if (this.resumeTokens.get(playerId) !== message.resumeToken) {
      this.rejectKeepingConnection(session, 'resumeExpired');
      return;
    }
    if (this.room.getController().resumePlayer(playerId) === null) {
      this.resumeTokens.delete(playerId);
      this.rejectKeepingConnection(session, 'resumeExpired');
      return;
    }
    this.room.detachSessionsOfPlayer(playerId);
    this.welcomePlayer(session, playerId);
  }

  private admitPlayer(sessionId: string, session: ClientSession, message: JoinMessage): void {
    const controller = this.room.getController();
    if (controller.isFull()) {
      this.room.reject(sessionId, session, 'roomFull');
      return;
    }
    const nickname = sanitizeNickname(message.nickname, GAME_CONFIG);
    if (nickname === null) {
      this.rejectKeepingConnection(session, 'invalidNickname');
      return;
    }
    // 다른 사람이 먼저 고른 색이면 연결을 유지한 채 다시 고르게 한다.
    if (!controller.isColorAvailable(message.colorIndex)) {
      this.rejectKeepingConnection(session, 'colorTaken');
      return;
    }
    this.pruneTokens();
    controller.addPlayer(sessionId, nickname, message.colorIndex);
    this.welcomePlayer(session, sessionId);
  }

  private welcomePlayer(session: ClientSession, playerId: string): void {
    const controller = this.room.getController();
    const resumeToken = this.resumeTokens.get(playerId) ?? this.room.createToken();
    this.resumeTokens.set(playerId, resumeToken);
    session.playerId = playerId;
    this.room.send(session, { type: 'welcome', playerId, resumeToken, config: GAME_CONFIG });
    controller.buildSyncMessages().forEach((outgoing) => this.room.send(session, outgoing));
    this.room.broadcast(controller.buildRosterMessage());
    this.room.startTicker();
  }

  // 이미 방을 떠난 사람(대기실 퇴장·유예 만료)의 토큰은 새 사람이 들어올 때 정리한다.
  private pruneTokens(): void {
    const controller = this.room.getController();
    [...this.resumeTokens.keys()].filter((playerId) => !controller.hasPlayer(playerId)).forEach((playerId) => this.resumeTokens.delete(playerId));
  }

  private rejectKeepingConnection(session: ClientSession, reason: RejectReason): void {
    this.room.send(session, { type: 'rejected', reason });
    this.room.send(session, this.room.getController().buildRosterMessage());
  }
}
