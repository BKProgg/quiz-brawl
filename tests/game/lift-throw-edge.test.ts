import { describe, expect, it } from 'vitest';

import { processPlayerActions } from '../../src/game/action-dispatcher';
import { findScorerIds } from '../../src/game/answer-judge';
import { holdGrabbedTarget, launchGrabbedTarget, startGrab } from '../../src/game/grab-throw';
import { resolvePlayerCollisions } from '../../src/game/movement-physics';
import { releaseGrab } from '../../src/game/player-interrupt';
import { stepWorld } from '../../src/game/world-simulation';
import { addTestPlayer, ARENA_CENTER, CONFIG, createTestWorld, offsetPosition } from './test-helpers';

const TICK_SECONDS = 1 / CONFIG.serverTickRate;

function createScene() {
  const world = createTestWorld();
  const thrower = addTestPlayer(world, 'thrower', ARENA_CENTER, { isRightPressed: true });
  const target = addTestPlayer(world, 'target', offsetPosition(ARENA_CENTER, 40));
  return { world, thrower, target };
}

describe('잡는 순간', () => {
  it('밀려나던 상대를 잡으면 밀리던 힘이 사라진다', () => {
    const { world, thrower, target } = createScene();
    target.knockback = { x: 300, y: 0 };
    startGrab(thrower, target, world, CONFIG);
    expect(target.knockback).toEqual({ x: 0, y: 0 });
  });

  it('무적이던 사람도 잡으면 무적이 끝나 끼어들 수 있다', () => {
    const { world, thrower, target } = createScene();
    thrower.invincibleRemaining = 1;
    startGrab(thrower, target, world, CONFIG);
    expect(thrower.invincibleRemaining).toBe(0);
  });

  it('같은 틱에 서로 잡으면 먼저 처리된 쪽만 들고, 진 쪽의 Z는 뒤늦게 처리되지 않는다', () => {
    const { world, thrower, target } = createScene();
    target.input.isLeftPressed = true;
    thrower.input.punchCount = 1;
    target.input.punchCount = 1;
    stepWorld(world, TICK_SECONDS, CONFIG, () => 0.5);
    expect(thrower.state).toBe('lifting');
    expect(target.state).toBe('grabbed');
    expect(target.handledPunchCount).toBe(1);
  });
});

describe('들고 있는 동안', () => {
  it('벽에 붙어 들어도 들린 사람은 경기장 안에 있다', () => {
    const { world, thrower, target } = createScene();
    thrower.position = { x: ARENA_CENTER.x, y: CONFIG.arena.bottom };
    startGrab(thrower, target, world, CONFIG);
    holdGrabbedTarget(thrower, world, CONFIG);
    expect(target.position.y).toBe(CONFIG.arena.bottom);
  });

  it('다른 사람이 든 사람을 밀어도 들린 사람은 같은 틱에 따라간다', () => {
    const { world, thrower, target } = createScene();
    startGrab(thrower, target, world, CONFIG);
    addTestPlayer(world, 'pusher', offsetPosition(ARENA_CENTER, -20));
    stepWorld(world, TICK_SECONDS, CONFIG, () => 0.5);
    expect(target.position.x).toBe(thrower.position.x);
  });

  it('든 사람은 다른 사람과 부딪혀 밀려난다', () => {
    const { world, thrower, target } = createScene();
    startGrab(thrower, target, world, CONFIG);
    const other = addTestPlayer(world, 'other', offsetPosition(ARENA_CENTER, 10));
    const before = thrower.position.x;
    resolvePlayerCollisions([thrower, other], CONFIG);
    expect(thrower.position.x).toBeLessThan(before);
  });

  it('막기 키를 눌러도 막기가 되지 않고, 발차기도 나가지 않는다', () => {
    const { world, thrower, target } = createScene();
    startGrab(thrower, target, world, CONFIG);
    thrower.input.isBlockPressed = true;
    thrower.input.kickCount = 1;
    processPlayerActions(thrower, world, CONFIG);
    expect(thrower.isBlocking).toBe(false);
    expect(thrower.state).toBe('lifting');
  });

  it('판정 때 든 사람과 들린 사람이 함께 득점한다', () => {
    const { world, thrower, target } = createScene();
    startGrab(thrower, target, world, CONFIG);
    holdGrabbedTarget(thrower, world, CONFIG);
    const zone = { choiceIndex: 0, label: 'O', text: '', x: CONFIG.arena.left, y: CONFIG.arena.top, width: 1300, height: 595 };
    expect(findScorerIds([thrower, target], zone)).toEqual(['thrower', 'target']);
  });
});

describe('놓아줄 때', () => {
  it('던지면 들린 관계가 끝나고 던진 사람 쪽을 바라보며 날아간다', () => {
    const { world, thrower, target } = createScene();
    startGrab(thrower, target, world, CONFIG);
    thrower.facingSign = 1;
    launchGrabbedTarget(thrower, world, CONFIG);
    expect(target.grabbedById).toBeNull();
    expect(target.facingSign).toBe(-1);
    thrower.grabbedTargetId = target.id;
    target.state = 'grabbed';
    thrower.facingSign = -1;
    launchGrabbedTarget(thrower, world, CONFIG);
    expect(target.facingSign).toBe(1);
  });

  it('상대가 이미 들린 상태가 아니면 건드리지 않는다', () => {
    const { world, thrower, target } = createScene();
    startGrab(thrower, target, world, CONFIG);
    target.state = 'down';
    releaseGrab(thrower, world, CONFIG);
    expect(thrower.grabbedTargetId).toBeNull();
    expect(target.state).toBe('down');
    expect(target.invincibleRemaining).toBe(0);
  });

  it('들고 있는 사람이 없으면 아무 일도 없다', () => {
    const { world, thrower } = createScene();
    expect(() => releaseGrab(thrower, world, CONFIG)).not.toThrow();
  });
});
