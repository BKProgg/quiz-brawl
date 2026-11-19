import type { GameConfig } from './game-config';
import type { AnswerZone, GamePhase, ItemState, LogState, MeteorState, PlayerState, PublicQuestion, RankingEntry } from './game-types';

export interface JoinMessage {
  type: 'join';
  nickname: string;
  colorIndex: number;
}

export interface InputMessage {
  type: 'input';
  isUpPressed: boolean;
  isDownPressed: boolean;
  isLeftPressed: boolean;
  isRightPressed: boolean;
  isBlockPressed: boolean;
  punchCount: number;
  kickCount: number;
}

export interface AdminJoinMessage {
  type: 'adminJoin';
}

// 복귀 토큰은 입장할 때 본인에게만 전달된다. 화면에 보이는 playerId만으로는 남의 자리로 복귀할 수 없다.
export interface ResumeMessage {
  type: 'resume';
  playerId: string;
  resumeToken: string;
}

export interface StartMessage {
  type: 'start';
}

export interface NewGameMessage {
  type: 'newGame';
}

export interface PingMessage {
  type: 'ping';
  clientTime: number;
}

export type ClientMessage = JoinMessage | AdminJoinMessage | ResumeMessage | InputMessage | StartMessage | NewGameMessage | PingMessage;

export interface PlayerSnapshot {
  id: string;
  x: number;
  y: number;
  facingSign: 1 | -1;
  state: PlayerState;
  progress: number;
  isBlocking: boolean;
  isInvincible: boolean;
  heldItemId: string | null;
  score: number;
}

export interface ItemSnapshot {
  id: string;
  kind: number;
  x: number;
  y: number;
  state: ItemState;
}

export interface LogSnapshot {
  id: string;
  x: number;
  y: number;
  direction: 1 | -1;
  state: LogState;
}

export interface MeteorSnapshot {
  id: string;
  x: number;
  y: number;
  state: MeteorState;
  progress: number;
}

export interface RosterPlayer {
  id: string;
  nickname: string;
  colorIndex: number;
  isInWorld: boolean;
}

// 같은 자리로 새 연결이 들어와 옛 연결을 끊을 때 보내는 close 사유. 받은 쪽은 다시 붙지 않는다(두 탭이 자리를 뺏고 빼앗기는 일 방지).
export const REPLACED_CLOSE_REASON = 'replaced by reconnect';
// 관리자가 새 게임/중단을 눌러 방을 처음 상태로 되돌릴 때 플레이어를 내보내며 보내는 close 사유. 받은 쪽은 선택 화면부터 다시 시작한다.
export const ROOM_RESET_CLOSE_REASON = 'room reset';
// 캐릭터 선택 화면에 오래 머물러 서버가 끊은 경우. 브라우저는 화면을 만지거나 탭이 보일 때 다시 붙는다.
export const JOIN_TIMEOUT_CLOSE_REASON = 'join timeout';

export type RejectReason ='roomFull' | 'colorTaken' | 'resumeExpired' | 'invalidNickname' | 'invalidJoin';

export type ServerMessage =
  | { type: 'welcome'; playerId: string; resumeToken: string; config: GameConfig }
  | { type: 'adminWelcome'; config: GameConfig }
  | { type: 'rejected'; reason: RejectReason }
  | { type: 'roster'; players: RosterPlayer[] }
  | {
      type: 'snapshot';
      serverTime: number;
      phase: GamePhase;
      phaseRemaining: number;
      players: PlayerSnapshot[];
      items: ItemSnapshot[];
      logs: LogSnapshot[];
      meteors: MeteorSnapshot[];
    }
  | { type: 'question'; question: PublicQuestion | null }
  | { type: 'zones'; zones: AnswerZone[] }
  | { type: 'judged'; answerIndex: number; scorerIds: string[]; scores: Record<string, number> }
  | { type: 'finalResult'; rankings: RankingEntry[] }
  | { type: 'pong'; clientTime: number };
