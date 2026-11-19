import { describe, expect, it } from 'vitest';

import { stepWorld } from '../../src/game/world-simulation';
import { addTestPlayer, ARENA_CENTER, CONFIG, createSeededRandom, createTestWorld, offsetPosition } from './test-helpers';

const TICK_SECONDS = 1 / CONFIG.serverTickRate;
const random = createSeededRandom(4);

function runTicks(world: ReturnType<typeof createTestWorld>, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += TICK_SECONDS) {
    stepWorld(world, TICK_SECONDS, CONFIG, random);
  }
}

describe('stepWorld', () => {
  it('주먹을 누르면 몇 틱 뒤 앞에 있는 상대가 경직된다', () => {
    const world = createTestWorld();
    const attacker = addTestPlayer(world, 'attacker', ARENA_CENTER);
    const target = addTestPlayer(world, 'target', offsetPosition(ARENA_CENTER, CONFIG.punch.range));
    attacker.input.punchCount = 1;
    runTicks(world, CONFIG.punch.hitTimeSeconds + TICK_SECONDS * 2);
    expect(target.state).toBe('stunned');
    expect(target.position.x).toBeGreaterThan(ARENA_CENTER.x + CONFIG.punch.range);
  });

  it('상대를 잡아 던지면 공중을 거쳐 다운된다', () => {
    const world = createTestWorld();
    const thrower = addTestPlayer(world, 'thrower', ARENA_CENTER, { isRightPressed: true });
    const target = addTestPlayer(world, 'target', offsetPosition(ARENA_CENTER, 50));
    thrower.input.punchCount = 1;
    runTicks(world, TICK_SECONDS);
    expect(target.state).toBe('grabbed');
    runTicks(world, CONFIG.throwing.minHoldSeconds);
    thrower.input.punchCount = 2;
    runTicks(world, TICK_SECONDS);
    expect(target.state).toBe('airborne');
    runTicks(world, CONFIG.throwing.airborneSeconds + TICK_SECONDS);
    expect(target.state).toBe('down');
  });

  it('같은 틱에 서로 주먹을 휘두르면 둘 다 맞는다', () => {
    const world = createTestWorld();
    const first = addTestPlayer(world, 'first', ARENA_CENTER);
    const second = addTestPlayer(world, 'second', offsetPosition(ARENA_CENTER, CONFIG.punch.range));
    second.facing = { x: -1, y: 0 };
    first.input.punchCount = 1;
    second.input.punchCount = 1;
    runTicks(world, CONFIG.punch.hitTimeSeconds + TICK_SECONDS * 2);
    expect(first.state).toBe('stunned');
    expect(second.state).toBe('stunned');
  });

  it('매 틱마다 월드 시간이 흐른다', () => {
    const world = createTestWorld();
    stepWorld(world, TICK_SECONDS, CONFIG, random);
    expect(world.time).toBeCloseTo(TICK_SECONDS);
  });
});
