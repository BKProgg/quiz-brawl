import { describe, expect, it } from 'vitest';

import {
  computeMoveVelocity,
  integratePlayerPosition,
  readInputDirection,
  resolvePlayerCollisions,
  updatePlayerFacing,
} from '../../src/game/movement-physics';
import { createEmptyInput } from '../../src/game/player-factory';
import { addTestPlayer, ARENA_CENTER, CONFIG, createTestWorld, offsetPosition } from './test-helpers';

describe('readInputDirection', () => {
  it('아무 키도 누르지 않으면 정지 방향이다', () => {
    expect(readInputDirection(createEmptyInput())).toEqual({ x: 0, y: 0 });
  });

  it('대각선 입력은 길이 1로 정규화된다', () => {
    const direction = readInputDirection({ ...createEmptyInput(), isRightPressed: true, isDownPressed: true });
    expect(Math.hypot(direction.x, direction.y)).toBeCloseTo(1);
  });
});

describe('computeMoveVelocity', () => {
  it('자유 상태가 아니면 움직이지 않는다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', ARENA_CENTER, { isRightPressed: true });
    player.state = 'stunned';
    expect(computeMoveVelocity(player, CONFIG)).toEqual({ x: 0, y: 0 });
  });

  it('막기 중에는 이동 속도가 줄어든다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', ARENA_CENTER, { isRightPressed: true });
    player.isBlocking = true;
    expect(computeMoveVelocity(player, CONFIG).x).toBeCloseTo(CONFIG.player.moveSpeed * CONFIG.player.blockMoveSpeedRatio);
  });

  it('평소에는 기본 이동 속도로 움직인다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', ARENA_CENTER, { isLeftPressed: true });
    expect(computeMoveVelocity(player, CONFIG).x).toBeCloseTo(-CONFIG.player.moveSpeed);
  });
});

describe('updatePlayerFacing', () => {
  it('자유 상태가 아니면 방향을 바꾸지 않는다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', ARENA_CENTER, { isLeftPressed: true });
    player.state = 'punching';
    updatePlayerFacing(player);
    expect(player.facingSign).toBe(1);
  });

  it('입력이 없으면 이전 방향을 유지한다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', ARENA_CENTER);
    updatePlayerFacing(player);
    expect(player.facing).toEqual({ x: 1, y: 0 });
  });

  it('위아래로만 움직이면 좌우 방향(facingSign)은 유지한다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', ARENA_CENTER, { isUpPressed: true });
    updatePlayerFacing(player);
    expect(player.facing).toEqual({ x: 0, y: -1 });
    expect(player.facingSign).toBe(1);
  });

  it('왼쪽으로 움직이면 왼쪽을 바라본다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', ARENA_CENTER, { isLeftPressed: true });
    updatePlayerFacing(player);
    expect(player.facingSign).toBe(-1);
  });
});

describe('integratePlayerPosition', () => {
  it('넉백은 시간이 지나면 줄어든다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', ARENA_CENTER);
    player.knockback = { x: 300, y: 0 };
    integratePlayerPosition(player, 0.1, CONFIG);
    expect(player.position.x).toBeCloseTo(ARENA_CENTER.x + 30);
    expect(player.knockback.x).toBeLessThan(300);
  });

  it('공중 상태에서는 넉백이 줄지 않는다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', ARENA_CENTER);
    player.state = 'airborne';
    player.knockback = { x: 300, y: 0 };
    integratePlayerPosition(player, 0.1, CONFIG);
    expect(player.knockback.x).toBe(300);
  });

  it('경기장 밖으로 나가지 않는다', () => {
    const player = addTestPlayer(createTestWorld(), 'a', { x: CONFIG.arena.right, y: CONFIG.arena.top });
    player.knockback = { x: 1000, y: -1000 };
    integratePlayerPosition(player, 0.5, CONFIG);
    expect(player.position).toEqual({ x: CONFIG.arena.right, y: CONFIG.arena.top });
  });
});

describe('resolvePlayerCollisions', () => {
  it('겹친 두 캐릭터를 서로 밀어낸다', () => {
    const world = createTestWorld();
    const first = addTestPlayer(world, 'a', ARENA_CENTER);
    const second = addTestPlayer(world, 'b', offsetPosition(ARENA_CENTER, 10));
    resolvePlayerCollisions([first, second], CONFIG);
    expect(second.position.x - first.position.x).toBeCloseTo(CONFIG.player.radius * 2);
  });

  it('같은 위치에 겹치면 가로 방향으로 밀어낸다', () => {
    const world = createTestWorld();
    const first = addTestPlayer(world, 'a', ARENA_CENTER);
    const second = addTestPlayer(world, 'b', ARENA_CENTER);
    resolvePlayerCollisions([first, second], CONFIG);
    expect(second.position.x).toBeGreaterThan(first.position.x);
  });

  it('쓰러진 캐릭터는 밀어내지 않는다', () => {
    const world = createTestWorld();
    const first = addTestPlayer(world, 'a', ARENA_CENTER);
    const second = addTestPlayer(world, 'b', offsetPosition(ARENA_CENTER, 10));
    second.state = 'down';
    resolvePlayerCollisions([first, second], CONFIG);
    expect(second.position.x).toBe(ARENA_CENTER.x + 10);
  });

  it('충분히 떨어져 있으면 그대로 둔다', () => {
    const world = createTestWorld();
    const first = addTestPlayer(world, 'a', ARENA_CENTER);
    const second = addTestPlayer(world, 'b', offsetPosition(ARENA_CENTER, 200));
    resolvePlayerCollisions([first, second], CONFIG);
    expect(first.position).toEqual(ARENA_CENTER);
  });
});
