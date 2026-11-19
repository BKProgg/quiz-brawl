import type { AnswerZone, QuizQuestion } from '../../src/game/game-types';

import { describe, expect, it } from 'vitest';

import { findScorerIds, isPositionInsideZone, placeAnswerZones } from '../../src/game/answer-judge';
import { addTestPlayer, CONFIG, createSeededRandom, createTestWorld } from './test-helpers';

const OX_QUESTION: QuizQuestion = { id: 'ox', type: 'OX', text: 'OX 문제', answerIndex: 0 };
const CHOICE_QUESTION: QuizQuestion = { id: 'choice', type: 'CHOICE4', text: '4지선다', choices: ['가', '나', '다', '라'], answerIndex: 2 };

function isInsideArena(zone: AnswerZone): boolean {
  const { left, right, top, bottom } = CONFIG.arena;
  return zone.x >= left && zone.x + zone.width <= right && zone.y >= top && zone.y + zone.height <= bottom;
}

function isOverlapping(first: AnswerZone, second: AnswerZone): boolean {
  return first.x < second.x + second.width && second.x < first.x + first.width
    && first.y < second.y + second.height && second.y < first.y + first.height;
}

describe('placeAnswerZones', () => {
  it('OX 문제는 O, X 구역 2개를 만든다', () => {
    const zones = placeAnswerZones(OX_QUESTION, CONFIG, createSeededRandom(3));
    expect(zones.map((zone) => zone.label)).toEqual(['O', 'X']);
    expect(zones.every((zone) => zone.text === '')).toBe(true);
  });

  it('4지선다는 번호와 보기 글자가 있는 구역 4개를 만든다', () => {
    const zones = placeAnswerZones(CHOICE_QUESTION, CONFIG, createSeededRandom(5));
    expect(zones.map((zone) => zone.label)).toEqual(['1', '2', '3', '4']);
    expect(zones.map((zone) => zone.text)).toEqual(['가', '나', '다', '라']);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('구역은 경기장 안에 있고 서로 겹치지 않는다 (시드 %i)', (seed) => {
    const zones = placeAnswerZones(CHOICE_QUESTION, CONFIG, createSeededRandom(seed));
    expect(zones.every(isInsideArena)).toBe(true);
    zones.forEach((zone, index) => zones.slice(index + 1).forEach((other) => expect(isOverlapping(zone, other)).toBe(false)));
  });

  it('무작위 배치에 실패하면 격자 배치로 대신한다', () => {
    const zones = placeAnswerZones(CHOICE_QUESTION, CONFIG, () => 0.5);
    expect(zones).toHaveLength(4);
    expect(zones.every(isInsideArena)).toBe(true);
    expect(isOverlapping(zones[0] as AnswerZone, zones[1] as AnswerZone)).toBe(false);
  });
});

describe('정답 판정', () => {
  const zone: AnswerZone = { choiceIndex: 0, label: 'O', text: '', x: 200, y: 200, width: 100, height: 100 };

  it('구역 경계는 안쪽으로 본다', () => {
    expect(isPositionInsideZone({ x: 200, y: 300 }, zone)).toBe(true);
    expect(isPositionInsideZone({ x: 199, y: 250 }, zone)).toBe(false);
  });

  it('구역 안에 있는 사람만 득점한다', () => {
    const world = createTestWorld();
    const inside = addTestPlayer(world, 'inside', { x: 250, y: 250 });
    const outside = addTestPlayer(world, 'outside', { x: 500, y: 250 });
    expect(findScorerIds([inside, outside], zone)).toEqual(['inside']);
  });

  it.each(['free', 'lifting', 'stunned', 'airborne', 'down', 'grabbed'] as const)('%s 상태여도 구역 위에 있으면 득점한다', (state) => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'player', { x: 250, y: 250 });
    player.state = state;
    expect(findScorerIds([player], zone)).toEqual(['player']);
  });

  it.each(['airborne', 'grabbed'] as const)('%s 상태여도 구역 밖이면 득점하지 않는다', (state) => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'player', { x: 10, y: 10 });
    player.state = state;
    expect(findScorerIds([player], zone)).toEqual([]);
  });
});
