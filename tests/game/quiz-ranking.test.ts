import type { QuizQuestion } from '../../src/game/game-types';

import { describe, expect, it } from 'vitest';

import { selectQuestions, toPublicQuestion } from '../../src/game/quiz-questions';
import { rankPlayers } from '../../src/game/ranking-calculator';
import { addTestPlayer, ARENA_CENTER, CONFIG, createSeededRandom, createTestWorld } from './test-helpers';

const POOL: QuizQuestion[] = Array.from({ length: 8 }, (_, index) => ({
  id: `q${index}`,
  type: 'CHOICE4',
  text: `문제 ${index}`,
  choices: ['가', '나', '다', '라'],
  answerIndex: index % 4,
}));

describe('selectQuestions', () => {
  it('문제 풀에서 중복 없이 원하는 개수만큼 뽑는다', () => {
    const selected = selectQuestions(POOL, 5, createSeededRandom(2));
    expect(selected).toHaveLength(5);
    expect(new Set(selected.map((question) => question.id)).size).toBe(5);
  });

  it('풀이 원하는 개수보다 적으면 있는 만큼만 쓴다', () => {
    expect(selectQuestions(POOL.slice(0, 2), 5, createSeededRandom(2))).toHaveLength(2);
  });
});

describe('toPublicQuestion', () => {
  it('정답은 클라이언트로 보내지 않는다', () => {
    const publicQuestion = toPublicQuestion(POOL[1] as QuizQuestion, 0, 5, CONFIG);
    expect(publicQuestion).not.toHaveProperty('answerIndex');
    expect(JSON.stringify(publicQuestion)).not.toContain('answerIndex');
  });

  it('OX 문제의 보기는 O, X이고 카운트는 기본값을 쓴다', () => {
    const publicQuestion = toPublicQuestion({ id: 'ox', type: 'OX', text: 'OX', answerIndex: 0 }, 2, 5, CONFIG);
    expect(publicQuestion.choices).toEqual(['O', 'X']);
    expect(publicQuestion.countdownSeconds).toBe(CONFIG.timeline.answerCountdownSeconds);
  });

  it('문제별 카운트 시간이 있으면 그 값을 쓴다', () => {
    const question: QuizQuestion = { id: 'long', type: 'CHOICE4', text: '긴 문제', answerIndex: 0, countdownSeconds: 15 };
    expect(toPublicQuestion(question, 0, 1, CONFIG).countdownSeconds).toBe(15);
    expect(toPublicQuestion(question, 0, 1, CONFIG).choices).toEqual([]);
  });
});

describe('rankPlayers', () => {
  it('점수 순으로 정렬하고 동점은 같은 순위를 준다 (동점끼리는 색 번호 순)', () => {
    const world = createTestWorld();
    const scores: Record<string, number> = { 가: 300, 나: 500, 다: 300, 라: 100 };
    const players = Object.entries(scores).map(([id, score]) => {
      const player = addTestPlayer(world, id, ARENA_CENTER);
      player.score = score;
      return player;
    });
    expect(rankPlayers(players).map((entry) => [entry.playerId, entry.rank])).toEqual([['나', 1], ['가', 2], ['다', 2], ['라', 4]]);
  });

  it('플레이어가 없으면 빈 순위를 돌려준다', () => {
    expect(rankPlayers([])).toEqual([]);
  });
});
