import type { WorldState } from '../../src/game/game-types';

import { describe, expect, it } from 'vitest';

import { handlePunchPress } from '../../src/game/action-dispatcher';
import { applyStrikeHit } from '../../src/game/combat-resolver';
import { startGrab } from '../../src/game/grab-throw';
import { computeMoveVelocity, updatePlayerFacing } from '../../src/game/movement-physics';
import { updatePlayerTimers } from '../../src/game/player-state-timer';
import { stepWorld } from '../../src/game/world-simulation';
import { addTestPlayer, ARENA_CENTER, CONFIG, createTestWorld, offsetPosition } from './test-helpers';

const { throwing: THROWING } = CONFIG;
const TICK_SECONDS = 1 / CONFIG.serverTickRate;

function createLiftScene() {
  const world = createTestWorld();
  const thrower = addTestPlayer(world, 'thrower', ARENA_CENTER, { isRightPressed: true });
  const target = addTestPlayer(world, 'target', offsetPosition(ARENA_CENTER, 40));
  handlePunchPress(thrower, world, CONFIG);
  return { world, thrower, target };
}

function runSeconds(world: WorldState, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += TICK_SECONDS) {
    stepWorld(world, TICK_SECONDS, CONFIG, () => 0.5);
  }
}

describe('들기', () => {
  it('상대에게 붙어 Z를 누르면 든 사람과 들린 사람 상태가 된다', () => {
    const { thrower, target } = createLiftScene();
    expect(thrower.state).toBe('lifting');
    expect(thrower.grabbedTargetId).toBe(target.id);
    expect(target.state).toBe('grabbed');
    expect(target.stateDuration).toBe(THROWING.holdSeconds);
  });

  it('드는 동안 방향을 바꿀 수 있고 느리게 걷는다', () => {
    const { thrower } = createLiftScene();
    thrower.input = { ...thrower.input, isRightPressed: false, isUpPressed: true };
    updatePlayerFacing(thrower);
    expect(thrower.facing).toEqual({ x: 0, y: -1 });
    expect(computeMoveVelocity(thrower, CONFIG).y).toBeCloseTo(-CONFIG.player.moveSpeed * THROWING.holdMoveSpeedRatio);
  });

  it('들린 사람은 든 사람을 따라다니고, 시간이 지나면 진행도가 오른다', () => {
    const { world, thrower, target } = createLiftScene();
    runSeconds(world, 0.5);
    expect(thrower.position.x).toBeGreaterThan(ARENA_CENTER.x);
    expect(target.position).toEqual({ x: thrower.position.x, y: thrower.position.y + 1 });
    expect(target.stateElapsed).toBeGreaterThan(0.4);
  });

  it('쓰러진 사람은 방향을 바꾸지 못한다', () => {
    const { thrower } = createLiftScene();
    thrower.state = 'down';
    thrower.input = { ...thrower.input, isRightPressed: false, isUpPressed: true };
    updatePlayerFacing(thrower);
    expect(thrower.facing).toEqual({ x: 1, y: 0 });
    expect(computeMoveVelocity(thrower, CONFIG)).toEqual({ x: 0, y: 0 });
  });
});

describe('던지기', () => {
  it('잡은 직후의 연타는 무시한다', () => {
    const { world, thrower, target } = createLiftScene();
    thrower.stateElapsed = THROWING.minHoldSeconds - 0.01;
    handlePunchPress(thrower, world, CONFIG);
    expect(thrower.state).toBe('lifting');
    expect(target.state).toBe('grabbed');
  });

  it('다시 Z를 누르면 그 순간 바라보는 방향으로 던진다', () => {
    const { world, thrower, target } = createLiftScene();
    thrower.stateElapsed = THROWING.minHoldSeconds;
    thrower.facing = { x: 0, y: 1 };
    handlePunchPress(thrower, world, CONFIG);
    expect(thrower.state).toBe('free');
    expect(thrower.grabbedTargetId).toBeNull();
    expect(target.state).toBe('airborne');
    expect(target.knockback.y).toBeCloseTo(THROWING.airborneSpeed);
  });

  it('들린 사람이 끊겨 사라졌으면 던질 것 없이 자유 상태가 된다', () => {
    const { world, thrower, target } = createLiftScene();
    world.players.delete(target.id);
    thrower.stateElapsed = THROWING.minHoldSeconds;
    handlePunchPress(thrower, world, CONFIG);
    expect(thrower.state).toBe('free');
  });
});

describe('탈출', () => {
  it('제한 시간 안에 안 던지면 들린 사람이 빠져나오고 잠깐 무적이다', () => {
    const { world, thrower, target } = createLiftScene();
    updatePlayerTimers(thrower, world, THROWING.holdSeconds - 0.01, CONFIG);
    expect(target.state).toBe('grabbed');
    updatePlayerTimers(thrower, world, 0.01, CONFIG);
    expect(thrower.state).toBe('free');
    expect(thrower.grabbedTargetId).toBeNull();
    expect(target.state).toBe('free');
    expect(target.grabbedById).toBeNull();
    expect(target.invincibleRemaining).toBe(THROWING.releaseInvincibleSeconds);
  });

  it('빠져나온 사람을 바로 다시 잡을 수 없고, 주먹이 나간다', () => {
    const { world, thrower, target } = createLiftScene();
    updatePlayerTimers(thrower, world, THROWING.holdSeconds, CONFIG);
    handlePunchPress(thrower, world, CONFIG);
    expect(thrower.state).toBe('punching');
    expect(target.state).toBe('free');
  });

  it('든 사람이 사라져도 들린 사람이 풀려나 무적이 된다', () => {
    const { world, thrower, target } = createLiftScene();
    world.players.delete(thrower.id);
    updatePlayerTimers(target, world, TICK_SECONDS, CONFIG);
    expect(target.state).toBe('free');
    expect(target.invincibleRemaining).toBe(THROWING.releaseInvincibleSeconds);
  });
});

describe('제3자 끼어들기', () => {
  it('든 사람을 때리면 든 사람만 맞고 들린 사람은 안전하게 내려온다', () => {
    const { world, thrower, target } = createLiftScene();
    const attacker = addTestPlayer(world, 'attacker', offsetPosition(ARENA_CENTER, -40));
    applyStrikeHit(attacker, thrower, 'punch', world, CONFIG);
    expect(thrower.state).toBe('stunned');
    expect(target.state).toBe('free');
    expect(target.knockback).toEqual({ x: 0, y: 0 });
    expect(target.invincibleRemaining).toBe(THROWING.releaseInvincibleSeconds);
  });

  it('들린 사람은 때려도 맞지 않는다', () => {
    const { world, target } = createLiftScene();
    const attacker = addTestPlayer(world, 'attacker', offsetPosition(ARENA_CENTER, 80));
    expect(applyStrikeHit(attacker, target, 'punch', world, CONFIG)).toBe('ignored');
    expect(target.state).toBe('grabbed');
  });

  it('든 사람을 잡으면 그 사람이 들리고 처음 들렸던 사람은 풀려난다', () => {
    const { world, thrower, target } = createLiftScene();
    const third = addTestPlayer(world, 'third', offsetPosition(ARENA_CENTER, -40), { isRightPressed: true });
    target.position = offsetPosition(ARENA_CENTER, 200);
    startGrab(third, thrower, world, CONFIG);
    expect(thrower.state).toBe('grabbed');
    expect(thrower.grabbedTargetId).toBeNull();
    expect(target.state).toBe('free');
    expect(third.grabbedTargetId).toBe(thrower.id);
  });

  it('들린 사람은 잡을 수 없어 주먹이 나간다', () => {
    const { world, thrower, target } = createLiftScene();
    thrower.position = offsetPosition(ARENA_CENTER, -300);
    const third = addTestPlayer(world, 'third', offsetPosition(target.position, -40), { isRightPressed: true });
    handlePunchPress(third, world, CONFIG);
    expect(third.state).toBe('punching');
    expect(target.grabbedById).toBe(thrower.id);
  });
});
