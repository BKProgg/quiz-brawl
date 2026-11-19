import type { GameConfig } from '../game/game-config';
import type { MatchState, PlayerEntity, PublicQuestion, WorldState } from '../game/game-types';
import type { ServerMessage } from '../game/protocol-types';

import { findScorerIds } from '../game/answer-judge';
import { getCurrentQuestion } from '../game/phase-scheduler';
import { toPublicQuestion } from '../game/quiz-questions';

export type JudgedMessage = Extract<ServerMessage, { type: 'judged' }>;

// 클라이언트에 보낼 현재 문제. 정답은 빠져 있다.
export function buildPublicQuestion(match: MatchState, config: GameConfig): PublicQuestion | null {
  const question = getCurrentQuestion(match);
  return question ? toPublicQuestion(question, match.questionIndex, match.questions.length, config) : null;
}

// 카운트다운이 끝난 시점에 정답 칸 안에 있던 사람에게 점수를 주고 판정 메시지를 만든다.
export function judgeCurrentQuestion(match: MatchState, world: WorldState, config: GameConfig): JudgedMessage {
  const question = getCurrentQuestion(match);
  const answerZone = match.zones.find((zone) => zone.choiceIndex === question?.answerIndex);
  const players = [...world.players.values()];
  const scorerIds = answerZone ? findScorerIds(players, answerZone) : [];
  scorerIds.forEach((playerId) => {
    const scorer = world.players.get(playerId) as PlayerEntity;
    scorer.score += config.scoring.pointsPerCorrect;
  });
  const scores = Object.fromEntries(players.map((player) => [player.id, player.score]));
  return { type: 'judged', answerIndex: question?.answerIndex ?? -1, scorerIds, scores };
}
