import { describe, expect, it } from 'vitest';

import { OwnPlayerPredictor } from '../../src/client/own-player-predictor';
import { GAME_CONFIG } from '../../src/game/game-config';
import { createEmptyInput } from '../../src/game/player-factory';

const START = { x: 800, y: 480 };
const RIGHT_INPUT = { ...createEmptyInput(), isRightPressed: true };

function createActivePredictor(): OwnPlayerPredictor {
  const predictor = new OwnPlayerPredictor();
  predictor.reconcile(START, true, 50, 0, START);
  return predictor;
}

describe('OwnPlayerPredictor', () => {
  it('서버 위치를 받기 전에는 예측하지 않는다', () => {
    const predictor = new OwnPlayerPredictor();
    predictor.advance(0, 0.1, RIGHT_INPUT, [], GAME_CONFIG);
    expect(predictor.getPosition()).toBeNull();
  });

  it('자유 상태가 되면 지금 보이는 위치에서 예측을 시작한다', () => {
    const predictor = new OwnPlayerPredictor();
    predictor.reconcile({ x: 900, y: 480 }, true, 50, 0, START);
    expect(predictor.getPosition()).toEqual(START);
  });

  it('키를 누르면 바로 이동한다', () => {
    const predictor = createActivePredictor();
    predictor.advance(10, 0.1, RIGHT_INPUT, [], GAME_CONFIG);
    expect(predictor.getPosition()?.x).toBeCloseTo(START.x + GAME_CONFIG.player.moveSpeed * 0.1);
  });

  it('막기 중에는 느리게 이동한다', () => {
    const predictor = createActivePredictor();
    predictor.advance(10, 0.1, { ...RIGHT_INPUT, isBlockPressed: true }, [], GAME_CONFIG);
    expect(predictor.getPosition()?.x).toBeCloseTo(START.x + GAME_CONFIG.player.moveSpeed * GAME_CONFIG.player.blockMoveSpeedRatio * 0.1);
  });

  it('공격 키를 누르면 서버 응답이 올 때까지 이동을 멈춘다', () => {
    const predictor = createActivePredictor();
    predictor.pauseForAction(0, 50, false);
    predictor.advance(100, 0.1, RIGHT_INPUT, [], GAME_CONFIG);
    expect(predictor.getPosition()).toEqual(START);
    predictor.advance(400, 0.1, RIGHT_INPUT, [], GAME_CONFIG);
    expect(predictor.getPosition()?.x).toBeGreaterThan(START.x);
  });

  it('막기 중에 누른 공격 키는 이동을 멈추지 않는다', () => {
    const predictor = createActivePredictor();
    predictor.pauseForAction(0, 50, true);
    predictor.advance(10, 0.1, RIGHT_INPUT, [], GAME_CONFIG);
    expect(predictor.getPosition()?.x).toBeGreaterThan(START.x);
  });

  it('다른 캐릭터와 겹치지 않게 밀려난다', () => {
    const predictor = createActivePredictor();
    const obstacle = { x: START.x + 30, y: START.y };
    predictor.advance(10, 0.1, RIGHT_INPUT, [obstacle], GAME_CONFIG);
    const position = predictor.getPosition();
    expect(position && Math.hypot(position.x - obstacle.x, position.y - obstacle.y)).toBeCloseTo(GAME_CONFIG.player.radius * 2);
  });

  it('경기장 밖으로 예측하지 않는다', () => {
    const predictor = new OwnPlayerPredictor();
    const edge = { x: GAME_CONFIG.arena.right, y: START.y };
    predictor.reconcile(edge, true, 50, 0, edge);
    predictor.advance(10, 0.5, RIGHT_INPUT, [], GAME_CONFIG);
    expect(predictor.getPosition()?.x).toBe(GAME_CONFIG.arena.right);
  });

  it('서버가 자유 상태가 아니면 예측을 끈다', () => {
    const predictor = createActivePredictor();
    predictor.reconcile(START, false, 50, 10, START);
    expect(predictor.getPosition()).toBeNull();
  });

  it('오차가 작으면 조금씩 서버 위치로 맞춘다', () => {
    const predictor = createActivePredictor();
    predictor.reconcile({ x: START.x + 50, y: START.y }, true, 50, 100, START);
    expect(predictor.getPosition()?.x).toBeCloseTo(START.x + 10);
  });

  it('오차가 크면 서버 위치로 바로 옮긴다', () => {
    const predictor = createActivePredictor();
    predictor.reconcile({ x: START.x + 300, y: START.y }, true, 50, 100, START);
    expect(predictor.getPosition()?.x).toBe(START.x + 300);
  });

  it('왕복 지연만큼 과거의 예측 위치와 비교한다', () => {
    const predictor = createActivePredictor();
    predictor.advance(100, 0.1, RIGHT_INPUT, [], GAME_CONFIG);
    predictor.advance(200, 0.1, RIGHT_INPUT, [], GAME_CONFIG);
    const pastX = START.x + GAME_CONFIG.player.moveSpeed * 0.1;
    const beforeX = predictor.getPosition()?.x ?? 0;
    predictor.reconcile({ x: pastX, y: START.y }, true, 100, 200, START);
    expect(predictor.getPosition()?.x).toBeCloseTo(beforeX);
  });
});
