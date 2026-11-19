import type { GameConfig } from '../game/game-config';
import type { AnswerZone, GamePhase, PublicQuestion, RankingEntry } from '../game/game-types';
import type { RejectReason, RosterPlayer, ServerMessage } from '../game/protocol-types';

import { SnapshotInterpolator } from './snapshot-interpolator';

export interface Judgement {
  answerIndex: number;
  scorerIds: string[];
  receivedAt: number;
}

export interface ClientGameState {
  playerId: string | null;
  config: GameConfig | null;
  roster: Map<string, RosterPlayer>;
  phase: GamePhase;
  phaseRemaining: number;
  phaseReceivedAt: number;
  question: PublicQuestion | null;
  questionReceivedAt: number;
  zones: AnswerZone[];
  zonesReceivedAt: number;
  judgement: Judgement | null;
  finalRankings: RankingEntry[] | null;
  finalReceivedAt: number;
  rejectReason: RejectReason | null;
  oneWayLatencySeconds: number;
  isAdminView: boolean;
  interpolator: SnapshotInterpolator;
}

export function createClientState(): ClientGameState {
  return {
    playerId: null,
    config: null,
    roster: new Map(),
    phase: 'lobby',
    phaseRemaining: 0,
    phaseReceivedAt: 0,
    question: null,
    questionReceivedAt: 0,
    zones: [],
    zonesReceivedAt: 0,
    judgement: null,
    finalRankings: null,
    finalReceivedAt: 0,
    rejectReason: null,
    oneWayLatencySeconds: 0,
    isAdminView: false,
    interpolator: new SnapshotInterpolator(),
  };
}

export function applyServerMessage(state: ClientGameState, message: ServerMessage, now: number): void {
  switch (message.type) {
    case 'welcome':
      state.playerId = message.playerId;
      state.config = message.config;
      break;
    case 'adminWelcome':
      state.config = message.config;
      state.isAdminView = true;
      break;
    case 'rejected':
      state.rejectReason = message.reason;
      break;
    case 'roster':
      state.roster = new Map(message.players.map((player) => [player.id, player]));
      break;
    case 'snapshot':
      state.phase = message.phase;
      state.phaseRemaining = message.phaseRemaining;
      state.phaseReceivedAt = now;
      state.interpolator.push(message, now);
      break;
    case 'question':
      state.question = message.question;
      state.questionReceivedAt = now;
      state.judgement = null;
      break;
    case 'zones':
      state.zones = message.zones;
      state.zonesReceivedAt = now;
      break;
    case 'judged':
      state.judgement = { answerIndex: message.answerIndex, scorerIds: message.scorerIds, receivedAt: now };
      break;
    case 'finalResult':
      state.finalRankings = message.rankings;
      state.finalReceivedAt = now;
      break;
    default:
      break;
  }
}

// 스냅샷은 편도 지연만큼 늦게 도착하므로, 그만큼 빼서 서버 판정 시점에 화면도 0이 되게 한다.
export function getPhaseRemaining(state: ClientGameState, now: number): number {
  return Math.max(0, state.phaseRemaining - (now - state.phaseReceivedAt) / 1000 - state.oneWayLatencySeconds);
}

export function isSpectating(state: ClientGameState): boolean {
  return state.playerId !== null && state.roster.get(state.playerId)?.isInWorld === false;
}
