import type { WorldState } from '../../src/game/game-types';

import { describe, expect, it } from 'vitest';

import { launchPlayerBackward } from '../../src/game/combat-resolver';
import { launchGrabbedTarget, startGrab } from '../../src/game/grab-throw';
import { spawnMeteor, updateMeteors } from '../../src/game/meteor-system';
import { updateRollingLogs } from '../../src/game/rolling-log-system';
import { stepWorld } from '../../src/game/world-simulation';
import { addTestPlayer, ARENA_CENTER, CONFIG, createTestWorld, offsetPosition } from './test-helpers';

const { meteor: METEOR } = CONFIG;
const TICK_SECONDS = 1 / CONFIG.serverTickRate;

function strikeAtCenter(world: WorldState): void {
  const meteor = spawnMeteor(world, CONFIG, () => 0);
  meteor.x = ARENA_CENTER.x;
  meteor.y = ARENA_CENTER.y;
  updateMeteors(world, METEOR.warningSeconds, CONFIG);
}

function runSeconds(world: WorldState, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += TICK_SECONDS) {
    stepWorld(world, TICK_SECONDS, CONFIG, () => 0.5);
  }
}

function runUntilState(world: WorldState, playerId: string, state: string): void {
  for (let tick = 0; tick < 300 && world.players.get(playerId)?.state !== state; tick += 1) {
    stepWorld(world, TICK_SECONDS, CONFIG, () => 0.5);
  }
}

describe('메테오 공정성', () => {
  it('가장 늦은 착지(판정 5초 전)에 맞아도 판정 전에 제자리로 돌아올 수 있다', () => {
    const world = createTestWorld();
    const origin = offsetPosition(ARENA_CENTER, 100);
    const player = addTestPlayer(world, 'p', origin);
    strikeAtCenter(world);
    let elapsed = 0;
    for (; elapsed < METEOR.minLandRemainingSeconds && player.position.x - origin.x > 0; elapsed += TICK_SECONDS) {
      player.input.isLeftPressed = player.state === 'free';
      stepWorld(world, TICK_SECONDS, CONFIG, () => 0.5);
    }
    expect(player.position.x).toBeLessThanOrEqual(origin.x);
    expect(elapsed).toBeLessThan(METEOR.minLandRemainingSeconds);
  });
});

describe('쓰러지는 시간이 섞이지 않는다', () => {
  it('메테오로 1.5초 쓰러진 뒤의 일반 다운은 다시 기본 시간이다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'p', offsetPosition(ARENA_CENTER, 100));
    strikeAtCenter(world);
    runUntilState(world, 'p', 'down');
    expect(player.stateDuration).toBe(METEOR.downSeconds);
    runUntilState(world, 'p', 'free');
    launchPlayerBackward(player, { x: -1, y: 0 }, world, CONFIG);
    runUntilState(world, 'p', 'down');
    expect(player.stateDuration).toBe(CONFIG.down.durationSeconds);
  });

  it('메테오로 쓰러진 뒤 잡아 던져져도 기본 시간이다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'p', offsetPosition(ARENA_CENTER, 100));
    strikeAtCenter(world);
    runUntilState(world, 'p', 'down');
    runUntilState(world, 'p', 'free');
    const thrower = addTestPlayer(world, 'thrower', offsetPosition(player.position, -40));
    startGrab(thrower, player, world, CONFIG);
    launchGrabbedTarget(thrower, world, CONFIG);
    runUntilState(world, 'p', 'down');
    expect(player.stateDuration).toBe(CONFIG.down.durationSeconds);
  });

  it('통나무에 먼저 맞아 공중에 있으면 메테오를 맞지 않아 기본 시간만 쓰러진다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'p', offsetPosition(ARENA_CENTER, 100));
    world.logs.set('log', { id: 'log', x: player.position.x, y: player.position.y, direction: 1, state: 'rolling', warningElapsed: 1 });
    updateRollingLogs(world, TICK_SECONDS, CONFIG, () => 0.5);
    expect(player.state).toBe('airborne');
    strikeAtCenter(world);
    world.logs.clear();
    runUntilState(world, 'p', 'down');
    expect(player.stateDuration).toBe(CONFIG.down.durationSeconds);
  });

  it('맞은 뒤 일어나면 무적이라 바로 다시 맞지 않는다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'p', offsetPosition(ARENA_CENTER, 100));
    strikeAtCenter(world);
    runUntilState(world, 'p', 'free');
    runSeconds(world, TICK_SECONDS);
    world.meteors.clear();
    strikeAtCenter(world);
    expect(player.state).toBe('free');
  });
});
