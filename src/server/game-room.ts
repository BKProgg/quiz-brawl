import type { QuizQuestion } from '../game/game-types';
import type { RejectReason, ServerMessage } from '../game/protocol-types';
import type { ClientSession } from './client-session';
import type { CommandPort } from './room-command-handler';
import type { ServerEnv } from './server-env';

import { DurableObject } from 'cloudflare:workers';

import { GAME_CONFIG } from '../game/game-config';
import { JOIN_TIMEOUT_CLOSE_REASON } from '../game/protocol-types';
import { closeSessionSocket, consumeRateLimit, createClientSession, hasJoined, isSessionSilent, sendToSession } from './client-session';
import { detachSessionsOfPlayer, findQuietPlayerIds, kickPlayerSessions, runGuarded } from './game-room-helpers';
import { MatchController } from './match-controller';
import { parseClientMessage } from './message-parser';
import { handleRoomCommand } from './room-command-handler';
import { RoomEntryHandler } from './room-entry-handler';
import { RoomTicker } from './room-ticker';
import { buildUpgradeRequiredResponse, upgradeToWebSocket } from './websocket-upgrade';
import questionPool from './questions.json';

const TICK_SECONDS = 1 / GAME_CONFIG.serverTickRate;
const SNAPSHOT_INTERVAL_SECONDS = 1 / GAME_CONFIG.snapshotRate;
const { network } = GAME_CONFIG;
const SILENCE_TIMEOUT_MILLISECONDS = network.silenceTimeoutSeconds * 1000;
const KEY_RELEASE_MILLISECONDS = network.keyReleaseSilenceSeconds * 1000;
// 방 하나(= Durable Object 하나). 접속·메시지 검증·틱 루프를 맡는다. 게임 진행은 MatchController에 맡긴다.
export class GameRoom extends DurableObject<ServerEnv> {
  private readonly sessions = new Map<string, ClientSession>();
  private controller = this.createController();
  private readonly entryHandler = new RoomEntryHandler({
    getController: () => this.controller,
    send: (session, message) => this.send(session, message),
    broadcast: (message) => this.broadcast(message),
    reject: (sessionId, session, reason) => this.reject(sessionId, session, reason),
    detachSessionsOfPlayer: (playerId) => this.detachSessionsOfPlayer(playerId),
    startTicker: () => this.ticker.start(),
    createToken: () => crypto.randomUUID(),
  });
  private readonly commandPort: CommandPort = {
    getController: () => this.controller,
    send: (session, message) => this.send(session, message),
    broadcast: (message) => this.broadcast(message),
    resetRoom: () => this.resetRoom(),
  };
  private readonly ticker = new RoomTicker(
    TICK_SECONDS,
    SNAPSHOT_INTERVAL_SECONDS,
    (deltaSeconds) => this.runTick(deltaSeconds),
    (serverTime) => runGuarded('snapshot', () => this.broadcast(this.controller.buildSnapshot(serverTime))),
  );

  // 입장 전 연결은 개수를 제한하고, 일정 시간 안에 입장하지 않으면 끊는다(무료 한도 소진 방지).
  async fetch(request: Request): Promise<Response> {
    const pendingCount = [...this.sessions.values()].filter((session) => !hasJoined(session)).length;
    if (pendingCount >= network.maxPendingSessions) {
      return new Response('잠시 후 다시 시도해 주세요.', { status: 503 });
    }
    const sessionId = crypto.randomUUID();
    const upgraded = upgradeToWebSocket(request, {
      onMessage: (data) => runGuarded('message', () => this.handleMessage(sessionId, data)),
      onClose: () => runGuarded('close', () => this.handleClose(sessionId)),
    });
    if (upgraded === null) {
      return buildUpgradeRequiredResponse();
    }
    const session = createClientSession(upgraded.socket, Date.now());
    this.sessions.set(sessionId, session);
    this.send(session, this.controller.buildRosterMessage());
    setTimeout(() => {
      const pending = this.sessions.get(sessionId);
      if (pending && !hasJoined(pending)) {
        this.closeSession(sessionId, JOIN_TIMEOUT_CLOSE_REASON);
      }
    }, network.joinTimeoutSeconds * 1000);
    return upgraded.response;
  }

  private createController(): MatchController {
    return new MatchController(GAME_CONFIG, questionPool as QuizQuestion[], Math.random);
  }

  // 틱마다 게임을 진행하고, 소식이 끊긴 연결은 서버가 먼저 끊어 유예 처리에 들어가게 한다. 그 전에 한동안 조용한 사람의 키부터 뗀다.
  // 유예 중인 사람이 있으면 아무도 접속해 있지 않아도 틱을 유지해, 유예가 끝나면 자리를 비우고 멈춘다.
  private runTick(deltaSeconds: number): void {
    try {
      const now = Date.now();
      findQuietPlayerIds(this.sessions, now, KEY_RELEASE_MILLISECONDS).forEach((playerId) => this.controller.releaseKeys(playerId));
      this.controller.tick(deltaSeconds, now).forEach((outgoing) => this.broadcast(outgoing));
      this.sessions.forEach((session, sessionId) => {
        if (isSessionSilent(session, now, SILENCE_TIMEOUT_MILLISECONDS)) {
          this.closeSession(sessionId, 'silent connection');
        }
      });
    } catch (error) {
      console.error('[GameRoom] tick failed', error);
    } finally {
      this.stopTickerIfIdle();
    }
  }

  private stopTickerIfIdle(): void {
    if (![...this.sessions.values()].some(hasJoined) && !this.controller.hasSuspended()) {
      this.ticker.stop();
    }
  }

  private handleMessage(sessionId: string, data: unknown): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (!consumeRateLimit(session, Date.now(), network.maxMessagesPerSecond)) {
      this.closeSession(sessionId, 'too many messages');
      return;
    }
    const message = parseClientMessage(data, GAME_CONFIG);
    if (message === null) {
      // 입장 전에 형식이 틀린 요청을 보내면 선택 화면이 "입장하는 중"에 멈추지 않게 알려 준다.
      if (!hasJoined(session)) {
        this.send(session, { type: 'rejected', reason: 'invalidJoin' });
      }
      return;
    }
    if (message.type === 'join' || message.type === 'adminJoin' || message.type === 'resume') {
      this.entryHandler.handle(sessionId, session, message);
      return;
    }
    // 핑은 입장 전(캐릭터 선택 화면)에도 답한다. 브라우저가 핑 응답으로 연결이 살아 있는지 판단하기 때문이다.
    if (hasJoined(session) || message.type === 'ping') {
      handleRoomCommand(this.commandPort, session, message);
    }
  }

  // 관리자가 새 게임/중단을 누르면 플레이어를 전부 내보내고 방을 처음 상태로 만든다. 모두 닉네임·캐릭터 선택부터 다시 한다.
  private resetRoom(): void {
    kickPlayerSessions(this.sessions);
    this.controller = this.createController();
    this.entryHandler.clearTokens();
    this.controller.buildSyncMessages().forEach((outgoing) => this.broadcast(outgoing));
    this.broadcast(this.controller.buildRosterMessage());
    this.stopTickerIfIdle();
  }

  private reject(sessionId: string, session: ClientSession, reason: RejectReason): void {
    this.send(session, { type: 'rejected', reason });
    this.closeSession(sessionId, reason);
  }

  // 상대의 close 응답을 기다리지 않고 바로 정리한다. 이미 정리된 세션이면 아무것도 하지 않는다.
  private closeSession(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    closeSessionSocket(session, reason);
    this.handleClose(sessionId);
  }

  // 같은 자리로 복귀한 새 연결이 있으면, 남아 있던 옛 연결은 플레이어와 분리해 끊는다(끊어도 자리는 그대로).
  private detachSessionsOfPlayer(playerId: string): void {
    detachSessionsOfPlayer(this.sessions, playerId);
  }

  // 플레이어가 나가면 유예 처리(게임 중) 또는 제거한다. 전원이 나가 방이 비면 새 방으로 바꾸고 관리자 화면도 맞춘다.
  private handleClose(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    this.sessions.delete(sessionId);
    if (session?.playerId) {
      this.controller.removePlayer(session.playerId, Date.now()).forEach((outgoing) => this.broadcast(outgoing));
      if (!this.controller.hasPlayers()) {
        this.controller = this.createController();
        this.entryHandler.clearTokens();
        this.controller.buildSyncMessages().forEach((outgoing) => this.broadcast(outgoing));
      }
      this.broadcast(this.controller.buildRosterMessage());
    }
    this.stopTickerIfIdle();
  }

  private send(session: ClientSession, message: ServerMessage): void {
    sendToSession(session, JSON.stringify(message));
  }

  // 명단(어떤 색이 사용 중인지)은 캐릭터 선택 화면에 있는 입장 전 연결에도 보낸다.
  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    this.sessions.forEach((session) => {
      if (hasJoined(session) || message.type === 'roster') {
        sendToSession(session, payload);
      }
    });
  }
}
