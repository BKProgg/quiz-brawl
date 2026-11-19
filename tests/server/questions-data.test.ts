import { GAME_CONFIG } from '../../src/game/game-config';
import type { QuizQuestion } from '../../src/game/game-types';

import { describe, expect, it } from 'vitest';

import exampleQuestionPool from '../../src/server/questions.example.json';
import questionPool from '../../src/server/questions.json';

// 실제 문제(git 제외)와 예시 문제(git 포함) 두 파일을 같은 기준으로 검사한다.
const pools = [
  ['questions.json', questionPool as QuizQuestion[]],
  ['questions.example.json', exampleQuestionPool as QuizQuestion[]],
] as const;

describe.each(pools)('%s', (_, questions) => {
  it('문제 id는 겹치지 않는다', () => {
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
  });

  it('한 판에 필요한 문제 수 이상 들어 있다', () => {
    expect(questions.length).toBeGreaterThanOrEqual(GAME_CONFIG.timeline.questionCount);
  });

  it.each(questions.map((question) => [question.id, question] as const))('%s 문제의 형식과 정답 번호가 올바르다', (_, question) => {
    const choiceCount = question.type === 'OX' ? 2 : 4;
    expect(['OX', 'CHOICE4']).toContain(question.type);
    expect(question.text.length).toBeGreaterThan(0);
    expect(question.answerIndex).toBeGreaterThanOrEqual(0);
    expect(question.answerIndex).toBeLessThan(choiceCount);
    if (question.type === 'CHOICE4') {
      expect(question.choices).toHaveLength(4);
    }
  });
});
