import type { GameConfig } from './game-config';
import type { PublicQuestion, QuizQuestion, RandomSource } from './game-types';

export const OX_CHOICES = ['O', 'X'];

export function selectQuestions(pool: QuizQuestion[], count: number, random: RandomSource): QuizQuestion[] {
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex] as QuizQuestion, shuffled[index] as QuizQuestion];
  }
  return shuffled.slice(0, count);
}

export function getChoices(question: QuizQuestion): string[] {
  return question.type === 'OX' ? [...OX_CHOICES] : [...(question.choices ?? [])];
}

export function getCountdownSeconds(question: QuizQuestion, config: GameConfig): number {
  return question.countdownSeconds ?? config.timeline.answerCountdownSeconds;
}

// 클라이언트로 보내는 문제. 정답(answerIndex)은 포함하지 않는다.
export function toPublicQuestion(question: QuizQuestion, index: number, total: number, config: GameConfig): PublicQuestion {
  return {
    index,
    total,
    type: question.type,
    text: question.text,
    choices: getChoices(question),
    countdownSeconds: getCountdownSeconds(question, config),
  };
}
