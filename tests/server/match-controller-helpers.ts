import type { QuizQuestion } from '../../src/game/game-types';
import type { ServerMessage } from '../../src/game/protocol-types';

import { GAME_CONFIG } from '../../src/game/game-config';
import { createEmptyInput } from '../../src/game/player-factory';
import { MatchController } from '../../src/server/match-controller';
import { createSeededRandom } from '../game/test-helpers';

export const QUESTIONS: QuizQuestion[] = [{ id: 'q1', type: 'OX', text: '문제', answerIndex: 0 }];
export const TICK_SECONDS = 1 / GAME_CONFIG.serverTickRate;

export function createController(questions: QuizQuestion[] = QUESTIONS): MatchController {
  return new MatchController(GAME_CONFIG, questions, createSeededRandom(11));
}

export function runSeconds(controller: MatchController, seconds: number, now = 0): ServerMessage[] {
  const messages: ServerMessage[] = [];
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += TICK_SECONDS) {
    messages.push(...controller.tick(TICK_SECONDS, now));
  }
  return messages;
}

// 원하는 메시지가 나올 때까지(최대 maxSeconds) 틱을 돌리고, 그때까지 나온 메시지를 돌려준다.
export function runUntil(controller: MatchController, type: ServerMessage['type'], maxSeconds: number): ServerMessage[] {
  const messages: ServerMessage[] = [];
  for (let elapsed = 0; elapsed < maxSeconds && !messages.some((message) => message.type === type); elapsed += TICK_SECONDS) {
    messages.push(...controller.tick(TICK_SECONDS, 0));
  }
  return messages;
}

export function findMessage<Type extends ServerMessage['type']>(messages: ServerMessage[], type: Type) {
  return messages.find((message): message is Extract<ServerMessage, { type: Type }> => message.type === type);
}

export function getSnapshotPlayer(controller: MatchController, playerId: string) {
  const snapshot = controller.buildSnapshot(0);
  return snapshot.type === 'snapshot' ? snapshot.players.find((player) => player.id === playerId) : undefined;
}

export function getSnapshotPhase(controller: MatchController) {
  const snapshot = controller.buildSnapshot(0);
  return snapshot.type === 'snapshot' ? snapshot.phase : undefined;
}

export function findRosterPlayer(controller: MatchController, playerId: string) {
  const roster = controller.buildRosterMessage();
  return roster.type === 'roster' ? roster.players.find((player) => player.id === playerId) : undefined;
}

// 첫 문제의 정답 구역이 나올 때까지 진행하고, 판정이 날 때까지 플레이어를 그 구역 중심으로 계속 걸어가게 한다.
// 도중에 통나무에 맞아 밖으로 날아가도 일어나서 다시 들어가도록 매 틱 방향키를 다시 누른다.
export function playFirstQuestionCorrectly(controller: MatchController, playerId: string): ServerMessage[] {
  const { timeline } = GAME_CONFIG;
  const messages = runSeconds(controller, timeline.introBrawlSeconds + timeline.zoneAppearDelaySeconds);
  const zonesMessage = messages.filter((message) => message.type === 'zones').at(-1);
  const answerZone = zonesMessage?.type === 'zones' ? zonesMessage.zones.find((zone) => zone.choiceIndex === QUESTIONS[0]?.answerIndex) : undefined;
  if (!answerZone) {
    throw new Error('정답 구역이 생기지 않았습니다.');
  }
  const target = { x: answerZone.x + answerZone.width / 2, y: answerZone.y + answerZone.height / 2 };
  const maxTicks = GAME_CONFIG.serverTickRate * (timeline.answerCountdownSeconds + 1);
  for (let tick = 0; tick < maxTicks && !messages.some((message) => message.type === 'judged'); tick += 1) {
    steerToward(controller, playerId, target);
    messages.push(...controller.tick(TICK_SECONDS, 0));
  }
  controller.setInput(playerId, createEmptyInput());
  return messages;
}

function steerToward(controller: MatchController, playerId: string, target: { x: number; y: number }): void {
  const player = getSnapshotPlayer(controller, playerId);
  if (!player) {
    return;
  }
  const input = createEmptyInput();
  input.isRightPressed = target.x > player.x + 5;
  input.isLeftPressed = target.x < player.x - 5;
  input.isDownPressed = target.y > player.y + 5;
  input.isUpPressed = target.y < player.y - 5;
  controller.setInput(playerId, input);
}
