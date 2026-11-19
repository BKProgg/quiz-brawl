import type { MatchState, QuizQuestion } from '../../src/game/game-types';
import type { MatchEvent } from '../../src/game/phase-scheduler';

import { describe, expect, it } from 'vitest';

import { advanceMatch, createLobbyMatch, getCurrentQuestion, getPhaseRemaining, returnToLobby, startMatch } from '../../src/game/phase-scheduler';
import { CONFIG, createSeededRandom } from './test-helpers';

const QUESTIONS: QuizQuestion[] = [
  { id: 'q1', type: 'OX', text: '첫 문제', answerIndex: 0 },
  { id: 'q2', type: 'CHOICE4', text: '둘째 문제', choices: ['가', '나', '다', '라'], answerIndex: 1, countdownSeconds: 15 },
];
const random = createSeededRandom(9);
const { timeline } = CONFIG;

function advance(match: MatchState, seconds: number): MatchEvent[] {
  return advanceMatch(match, seconds, CONFIG, random);
}

describe('startMatch', () => {
  it('문제가 없으면 시작할 수 없다', () => {
    expect(() => startMatch(createLobbyMatch(), [], CONFIG)).toThrow();
  });

  it('자유 난투로 시작한다', () => {
    const match = createLobbyMatch();
    startMatch(match, QUESTIONS, CONFIG);
    expect(match.phase).toBe('intro');
    expect(getPhaseRemaining(match)).toBe(timeline.introBrawlSeconds);
  });
});

describe('advanceMatch', () => {
  it('대기실에서는 진행하지 않는다', () => {
    const match = createLobbyMatch();
    expect(advance(match, 100)).toEqual([]);
    expect(match.phase).toBe('lobby');
  });

  it('한 판 전체 흐름을 순서대로 진행한다', () => {
    const match = createLobbyMatch();
    startMatch(match, QUESTIONS, CONFIG);
    expect(advance(match, timeline.introBrawlSeconds)).toEqual(['questionStarted']);
    expect(getCurrentQuestion(match)?.id).toBe('q1');
    expect(match.isZonesVisible).toBe(false);
    expect(advance(match, timeline.zoneAppearDelaySeconds)).toEqual(['zonesAppeared']);
    expect(match.zones).toHaveLength(2);
    // 30초를 한 번에 흘려 메테오 시작과 판정이 함께 나온다. 실제 서버는 1/30초 틱이라 따로 나온다.
    expect(advance(match, timeline.answerCountdownSeconds)).toEqual(['meteorStarted', 'questionJudged']);
    expect(match.phase).toBe('between');
    expect(getPhaseRemaining(match)).toBe(timeline.betweenBrawlSeconds);
    expect(advance(match, timeline.betweenBrawlSeconds)).toEqual(['questionStarted']);
    expect(match.zones).toEqual([]);
    expect(getPhaseRemaining(match)).toBe(15);
    advance(match, 15);
    expect(match.phase).toBe('between');
    expect(getPhaseRemaining(match)).toBe(timeline.finalRevealDelaySeconds);
    expect(advance(match, timeline.finalRevealDelaySeconds)).toEqual(['finalStarted']);
    // 최종 결과 화면은 관리자가 새 게임을 누를 때까지 유지된다.
    expect(advance(match, 600)).toEqual([]);
    expect(match.phase).toBe('final');
    returnToLobby(match);
    expect(match.phase).toBe('lobby');
  });

  it('구역 생성 전에 카운트가 끝나도 판정 전에 구역을 만든다', () => {
    const match = createLobbyMatch();
    startMatch(match, [{ id: 'short', type: 'OX', text: '짧은 문제', answerIndex: 1, countdownSeconds: 1 }], CONFIG);
    advance(match, timeline.introBrawlSeconds);
    expect(advance(match, 1)).toEqual(['zonesAppeared', 'questionJudged']);
    expect(match.zones).toHaveLength(2);
  });

  it.each([
    [0, CONFIG.meteor.minLandRemainingSeconds],
    [1, CONFIG.meteor.maxLandRemainingSeconds],
  ])('메테오는 문제마다 한 번, 판정 전 정해진 범위에 떨어지게 시작한다 (random=%d)', (randomValue, landRemaining) => {
    const match = createLobbyMatch();
    startMatch(match, QUESTIONS, CONFIG);
    advanceMatch(match, timeline.introBrawlSeconds, CONFIG, () => randomValue);
    const startElapsed = timeline.answerCountdownSeconds - landRemaining - CONFIG.meteor.warningSeconds;
    expect(match.meteorStartElapsed).toBeCloseTo(startElapsed);
    expect(advanceMatch(match, startElapsed - 0.1, CONFIG, () => randomValue)).toEqual(['zonesAppeared']);
    expect(advanceMatch(match, 0.1, CONFIG, () => randomValue)).toEqual(['meteorStarted']);
    expect(match.meteorStartElapsed).toBeNull();
    expect(advanceMatch(match, 0.1, CONFIG, () => randomValue)).toEqual([]);
  });

  it('문제 시간이 짧아 구역이 나오기 전에 경고가 시작되면 메테오를 내지 않는다', () => {
    const match = createLobbyMatch();
    startMatch(match, [{ id: 'short', type: 'OX', text: '짧은 문제', answerIndex: 1, countdownSeconds: 9 }], CONFIG);
    advanceMatch(match, timeline.introBrawlSeconds, CONFIG, () => 0);
    expect(match.meteorStartElapsed).toBeNull();
    expect(advance(match, 9)).toEqual(['zonesAppeared', 'questionJudged']);
  });

  it.each([
    [10, 0],
    [11, 1],
  ])('문제 시간이 짧으면 착지를 판정 쪽으로 당겨 구역이 나오는 순간에 경고를 시작한다 (%d초, random=%d)', (countdownSeconds, randomValue) => {
    const match = createLobbyMatch();
    startMatch(match, [{ id: 'short', type: 'OX', text: '짧은 문제', answerIndex: 1, countdownSeconds }], CONFIG);
    advanceMatch(match, timeline.introBrawlSeconds, CONFIG, () => randomValue);
    expect(match.meteorStartElapsed).toBeCloseTo(timeline.zoneAppearDelaySeconds);
  });

  it('시간이 남았으면 단계를 바꾸지 않는다', () => {
    const match = createLobbyMatch();
    startMatch(match, QUESTIONS, CONFIG);
    expect(advance(match, 1)).toEqual([]);
    expect(match.phase).toBe('intro');
  });
});
