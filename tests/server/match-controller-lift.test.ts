import type { PlayerEntity, QuizQuestion, WorldState } from '../../src/game/game-types';

import { describe, expect, it } from 'vitest';

import { GAME_CONFIG } from '../../src/game/game-config';
import { createEmptyInput } from '../../src/game/player-factory';
import { createController, findMessage, runSeconds, runUntil, TICK_SECONDS } from './match-controller-helpers';

const ONE_QUESTION: QuizQuestion[] = [{ id: 'q', type: 'OX', text: '문제', answerIndex: 0 }];
const { timeline, throwing: THROWING } = GAME_CONFIG;

function createLobby() {
  const controller = createController(ONE_QUESTION);
  controller.addPlayer('a', '가', 0);
  controller.addPlayer('b', '나', 1);
  const world = Reflect.get(controller, 'world') as WorldState;
  const thrower = world.players.get('a') as PlayerEntity;
  const target = world.players.get('b') as PlayerEntity;
  const grab = (): void => {
    target.position = { x: thrower.position.x + 40, y: thrower.position.y };
    controller.setInput('a', { ...createEmptyInput(), isRightPressed: true });
    controller.setInput('a', { ...createEmptyInput(), isRightPressed: true, punchCount: 1 });
    controller.tick(TICK_SECONDS, 0);
  };
  return { controller, thrower, target, grab };
}

describe('MatchController — 들고 던지기', () => {
  it('대기실에서 든 사람이 나가면 들린 사람이 바로 풀려난다', () => {
    const { controller, target, grab } = createLobby();
    grab();
    controller.removePlayer('a', 0);
    expect(target.state).toBe('free');
  });

  it('대기실에서 들린 사람이 나가면 든 사람이 바로 풀린다', () => {
    const { controller, thrower, grab } = createLobby();
    grab();
    expect(thrower.state).toBe('lifting');
    controller.removePlayer('b', 0);
    expect(thrower.state).toBe('free');
    expect(thrower.grabbedTargetId).toBeNull();
  });

  it('최종 화면에서는 들린 채 멈추고, 그때 든 사람이 끊기면 들린 사람이 풀려난다', () => {
    const { controller, thrower, target, grab } = createLobby();
    controller.startMatch();
    const messages = runUntil(controller, 'judged', timeline.introBrawlSeconds + timeline.answerCountdownSeconds + 1);
    expect(findMessage(messages, 'judged')).toBeDefined();
    runSeconds(controller, timeline.finalRevealDelaySeconds - THROWING.holdSeconds / 2);
    grab();
    runSeconds(controller, THROWING.holdSeconds);
    expect(thrower.state).toBe('lifting');
    expect(target.state).toBe('grabbed');
    controller.removePlayer('a', 0);
    expect(target.state).toBe('free');
  });
});
