import type { MeteorEntity, WorldState } from '../../src/game/game-types';

import { describe, expect, it } from 'vitest';

import { startGrab } from '../../src/game/grab-throw';
import { isInsideMeteorBlast, spawnMeteor, updateMeteors } from '../../src/game/meteor-system';
import { stepWorld } from '../../src/game/world-simulation';
import { addTestPlayer, ARENA_CENTER, CONFIG, createTestWorld, offsetPosition } from './test-helpers';

const { meteor: METEOR, arena } = CONFIG;

function spawnAtCenter(world: WorldState): MeteorEntity {
  const meteor = spawnMeteor(world, CONFIG, () => 0);
  meteor.x = ARENA_CENTER.x;
  meteor.y = ARENA_CENTER.y;
  return meteor;
}

function strike(world: WorldState): void {
  updateMeteors(world, METEOR.warningSeconds, CONFIG);
}

describe('spawnMeteor', () => {
  it('가로는 원이 경기장 안에, 세로는 가운데 절반 안에 떨어지고 번호가 늘어난다', () => {
    const world = createTestWorld();
    const height = arena.bottom - arena.top;
    const first = spawnMeteor(world, CONFIG, () => 0);
    const second = spawnMeteor(world, CONFIG, () => 1);
    expect(first).toMatchObject({ id: 'meteor-1', x: arena.left + METEOR.radius, y: arena.top + height / 4, state: 'warning' });
    expect(second).toMatchObject({ id: 'meteor-2', x: arena.right - METEOR.radius, y: arena.bottom - height / 4 });
    expect(world.meteors.size).toBe(2);
  });
});

describe('updateMeteors', () => {
  it('경고 중에는 아무도 맞지 않는다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'p', ARENA_CENTER);
    const meteor = spawnAtCenter(world);
    updateMeteors(world, METEOR.warningSeconds - 0.1, CONFIG);
    expect(meteor.state).toBe('warning');
    expect(player.state).toBe('free');
  });

  it('착지하면 범위 안의 사람은 중심 반대 방향으로 날아가고 밖의 사람은 그대로다', () => {
    const world = createTestWorld();
    const leftPlayer = addTestPlayer(world, 'left', offsetPosition(ARENA_CENTER, -100));
    const lowerPlayer = addTestPlayer(world, 'lower', offsetPosition(ARENA_CENTER, 0, 100));
    const outsider = addTestPlayer(world, 'outside', offsetPosition(ARENA_CENTER, METEOR.radius + 1));
    const meteor = spawnAtCenter(world);
    strike(world);
    expect(meteor.state).toBe('impact');
    expect(leftPlayer.state).toBe('airborne');
    expect(leftPlayer.knockback.x).toBeCloseTo(-METEOR.launchSpeed);
    expect(lowerPlayer.knockback.y).toBeCloseTo(METEOR.launchSpeed);
    expect(outsider.state).toBe('free');
  });

  it('판정 원은 화면의 경고 원보다 캐릭터 반지름만큼 작다', () => {
    const world = createTestWorld();
    const meteor = spawnAtCenter(world);
    const hitRadius = METEOR.radius - CONFIG.player.radius;
    expect(isInsideMeteorBlast(meteor, offsetPosition(ARENA_CENTER, hitRadius), CONFIG)).toBe(true);
    expect(isInsideMeteorBlast(meteor, offsetPosition(ARENA_CENTER, hitRadius + 1), CONFIG)).toBe(false);
  });

  it('정중앙에 있으면 바라보던 방향으로 날아간다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'p', ARENA_CENTER);
    player.facing = { x: 0, y: -1 };
    spawnAtCenter(world);
    strike(world);
    expect(player.knockback.y).toBeCloseTo(-METEOR.launchSpeed);
  });

  it('막기로는 못 막는다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'p', offsetPosition(ARENA_CENTER, 50));
    player.isBlocking = true;
    spawnAtCenter(world);
    strike(world);
    expect(player.state).toBe('airborne');
    expect(player.isBlocking).toBe(false);
  });

  it('무적이거나 이미 쓰러진 사람은 맞지 않는다', () => {
    const world = createTestWorld();
    const invincible = addTestPlayer(world, 'invincible', offsetPosition(ARENA_CENTER, 50));
    invincible.invincibleRemaining = 5;
    const fallen = addTestPlayer(world, 'fallen', offsetPosition(ARENA_CENTER, -50));
    fallen.state = 'down';
    spawnAtCenter(world);
    strike(world);
    expect(invincible.state).toBe('free');
    expect(fallen.state).toBe('down');
  });

  it('잡고 있던 사람이 맞으면 잡힌 사람은 맞지 않고 풀려난다', () => {
    const world = createTestWorld();
    const thrower = addTestPlayer(world, 'thrower', offsetPosition(ARENA_CENTER, 50));
    const target = addTestPlayer(world, 'target', offsetPosition(ARENA_CENTER, 80));
    startGrab(thrower, target, world, CONFIG);
    spawnAtCenter(world);
    strike(world);
    expect(thrower.state).toBe('airborne');
    expect(target.state).toBe('free');
    expect(target.grabbedById).toBeNull();
  });

  it('충돌은 한 번뿐이고, 화염이 끝나면 사라진다', () => {
    const world = createTestWorld();
    const meteor = spawnAtCenter(world);
    strike(world);
    const latecomer = addTestPlayer(world, 'late', ARENA_CENTER);
    updateMeteors(world, METEOR.impactSeconds - 0.1, CONFIG);
    expect(world.meteors.has(meteor.id)).toBe(true);
    expect(latecomer.state).toBe('free');
    updateMeteors(world, 0.1, CONFIG);
    expect(world.meteors.has(meteor.id)).toBe(false);
  });
});

describe('쓰러지는 시간', () => {
  function runUntilDown(world: WorldState): void {
    for (let tick = 0; tick < 30 && [...world.players.values()].some((player) => player.state !== 'down'); tick += 1) {
      stepWorld(world, 1 / 30, CONFIG, () => 0.5);
    }
  }

  it('메테오에 맞으면 1.5초 쓰러지고, 그 뒤 일어나 무적이 된다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'p', offsetPosition(ARENA_CENTER, 50));
    spawnAtCenter(world);
    strike(world);
    runUntilDown(world);
    expect(player.state).toBe('down');
    expect(player.stateDuration).toBe(METEOR.downSeconds);
    expect(player.landingDownSeconds).toBeNull();
    for (let tick = 0; tick < Math.ceil(METEOR.downSeconds * 30) + 1; tick += 1) {
      stepWorld(world, 1 / 30, CONFIG, () => 0.5);
    }
    expect(player.state).toBe('free');
    expect(player.invincibleRemaining).toBeGreaterThan(0);
  });
});
