import { describe, expect, it } from 'vitest';

import { findGrabTarget, holdGrabbedTarget, launchGrabbedTarget, startGrab } from '../../src/game/grab-throw';
import { updatePlayerTimers } from '../../src/game/player-state-timer';
import { addTestPlayer, ARENA_CENTER, CONFIG, createTestWorld, offsetPosition } from './test-helpers';

function createGrabScene(targetOffsetX = 40) {
  const world = createTestWorld();
  const thrower = addTestPlayer(world, 'thrower', ARENA_CENTER, { isRightPressed: true });
  const target = addTestPlayer(world, 'target', offsetPosition(ARENA_CENTER, targetOffsetX));
  return { world, thrower, target };
}

describe('findGrabTarget', () => {
  it('방향키를 누르지 않으면 잡지 않는다', () => {
    const { world, thrower } = createGrabScene();
    thrower.input.isRightPressed = false;
    expect(findGrabTarget(thrower, world, CONFIG)).toBeNull();
  });

  it('누른 방향에 닿아 있는 상대를 잡는다', () => {
    const { world, thrower, target } = createGrabScene();
    expect(findGrabTarget(thrower, world, CONFIG)).toBe(target);
  });

  it('막기 중인 상대도 잡을 수 있다 (던지기 > 막기)', () => {
    const { world, thrower, target } = createGrabScene();
    target.isBlocking = true;
    expect(findGrabTarget(thrower, world, CONFIG)).toBe(target);
  });

  it('반대 방향에 있는 상대는 잡지 않는다', () => {
    const { world, thrower } = createGrabScene(-40);
    expect(findGrabTarget(thrower, world, CONFIG)).toBeNull();
  });

  it('멀리 있는 상대는 잡지 않는다', () => {
    const { world, thrower } = createGrabScene(CONFIG.throwing.contactDistance + 10);
    expect(findGrabTarget(thrower, world, CONFIG)).toBeNull();
  });

  it('무적 상태의 상대는 잡지 않는다', () => {
    const { world, thrower, target } = createGrabScene();
    target.invincibleRemaining = 1;
    expect(findGrabTarget(thrower, world, CONFIG)).toBeNull();
  });

  it('여러 명이면 가장 가까운 상대를 잡는다', () => {
    const { world, thrower } = createGrabScene(55);
    const closer = addTestPlayer(world, 'closer', offsetPosition(ARENA_CENTER, 30));
    expect(findGrabTarget(thrower, world, CONFIG)).toBe(closer);
  });
});

describe('잡기와 던지기', () => {
  it('잡으면 잡은 사람은 드는 중, 상대는 잡힌 상태가 된다', () => {
    const { world, thrower, target } = createGrabScene();
    startGrab(thrower, target, world, CONFIG);
    expect(thrower.state).toBe('lifting');
    expect(target.state).toBe('grabbed');
    expect(target.grabbedById).toBe(thrower.id);
  });

  it('들린 상대는 든 사람과 같은 자리에서 1만큼 아래에 있어 앞에 그려진다', () => {
    const { world, thrower, target } = createGrabScene();
    startGrab(thrower, target, world, CONFIG);
    holdGrabbedTarget(thrower, world, CONFIG);
    expect(target.position).toEqual({ x: thrower.position.x, y: thrower.position.y + 1 });
  });

  it('잡은 상대가 없으면 붙잡지 않는다', () => {
    const { world, thrower, target } = createGrabScene();
    holdGrabbedTarget(thrower, world, CONFIG);
    expect(target.position.x).toBe(ARENA_CENTER.x + 40);
  });

  it('던지면 상대가 바라보는 방향으로 날아간다', () => {
    const { world, thrower, target } = createGrabScene();
    startGrab(thrower, target, world, CONFIG);
    launchGrabbedTarget(thrower, world, CONFIG);
    expect(target.state).toBe('airborne');
    expect(target.knockback.x).toBeCloseTo(CONFIG.throwing.airborneSpeed);
  });

  it('잡힌 상대가 이미 풀려났으면 던지지 않는다', () => {
    const { world, thrower, target } = createGrabScene();
    startGrab(thrower, target, world, CONFIG);
    target.state = 'free';
    launchGrabbedTarget(thrower, world, CONFIG);
    expect(target.state).toBe('free');
    expect(thrower.grabbedTargetId).toBeNull();
  });
});

describe('updatePlayerTimers', () => {
  it('공중 상태가 끝나면 착지하며 다운된다', () => {
    const { world, target } = createGrabScene();
    target.state = 'airborne';
    target.stateDuration = 0.2;
    target.knockback = { x: 500, y: 0 };
    updatePlayerTimers(target, world, 0.3, CONFIG);
    expect(target.state).toBe('down');
    expect(target.knockback.x).toBeCloseTo(100);
  });

  it('다운이 끝나면 일어나고 무적이 된다', () => {
    const { world, target } = createGrabScene();
    target.state = 'down';
    target.stateDuration = CONFIG.down.durationSeconds;
    updatePlayerTimers(target, world, CONFIG.down.durationSeconds, CONFIG);
    expect(target.state).toBe('free');
    expect(target.invincibleRemaining).toBe(CONFIG.down.invincibleSeconds);
  });

  it('잡은 사람이 사라지면 잡힌 상태가 풀린다', () => {
    const { world, thrower, target } = createGrabScene();
    startGrab(thrower, target, world, CONFIG);
    world.players.delete(thrower.id);
    updatePlayerTimers(target, world, 0.01, CONFIG);
    expect(target.state).toBe('free');
  });

  it('잡은 사람이 계속 잡고 있으면 잡힌 상태를 유지한다', () => {
    const { world, thrower, target } = createGrabScene();
    startGrab(thrower, target, world, CONFIG);
    updatePlayerTimers(target, world, 5, CONFIG);
    expect(target.state).toBe('grabbed');
  });

  it('무적 시간은 줄어들되 0 아래로 내려가지 않는다', () => {
    const { world, target } = createGrabScene();
    target.invincibleRemaining = 0.1;
    updatePlayerTimers(target, world, 0.5, CONFIG);
    expect(target.invincibleRemaining).toBe(0);
  });

  it('경직이 끝나면 자유 상태로 돌아간다', () => {
    const { world, target } = createGrabScene();
    target.state = 'stunned';
    target.stateDuration = 0.3;
    updatePlayerTimers(target, world, 0.1, CONFIG);
    expect(target.state).toBe('stunned');
    updatePlayerTimers(target, world, 0.3, CONFIG);
    expect(target.state).toBe('free');
  });
});
