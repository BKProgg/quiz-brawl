import { describe, expect, it } from 'vitest';

import { findPickupItem, pickUpItem, resetItems, tossHeldItem, updateItems } from '../../src/game/item-system';
import { addTestItem, addTestPlayer, ARENA_CENTER, CONFIG, createSeededRandom, createTestWorld, offsetPosition } from './test-helpers';

const random = createSeededRandom(1);

function createThrowScene() {
  const world = createTestWorld();
  const thrower = addTestPlayer(world, 'thrower', ARENA_CENTER);
  const item = addTestItem(world, 'item', ARENA_CENTER);
  pickUpItem(thrower, item);
  return { world, thrower, item };
}

describe('findPickupItem', () => {
  it('발밑의 바닥 아이템을 찾는다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'a', ARENA_CENTER);
    const item = addTestItem(world, 'item', offsetPosition(ARENA_CENTER, 10));
    expect(findPickupItem(player, world, CONFIG)).toBe(item);
  });

  it('멀리 있거나 누가 들고 있는 아이템은 줍지 않는다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'a', ARENA_CENTER);
    addTestItem(world, 'far', offsetPosition(ARENA_CENTER, 200));
    addTestItem(world, 'held', ARENA_CENTER, { state: 'held', holderId: 'other' });
    expect(findPickupItem(player, world, CONFIG)).toBeNull();
  });
});

describe('tossHeldItem', () => {
  it('들고 있던 아이템을 바라보는 방향으로 던진다', () => {
    const { world, thrower, item } = createThrowScene();
    tossHeldItem(thrower, world, CONFIG);
    expect(item.state).toBe('flying');
    expect(item.velocity.x).toBeCloseTo(CONFIG.item.throwSpeed);
    expect(thrower.heldItemId).toBeNull();
    expect(thrower.state).toBe('tossing');
  });

  it('들고 있는 아이템 정보가 없으면 아무것도 던지지 않는다', () => {
    const { world, thrower } = createThrowScene();
    world.items.clear();
    tossHeldItem(thrower, world, CONFIG);
    expect(thrower.state).toBe('free');
  });
});

describe('updateItems — 날아가는 아이템', () => {
  it('직선상의 처음 맞은 상대 1명만 다운시키고 사라진다', () => {
    const { world, thrower, item } = createThrowScene();
    const first = addTestPlayer(world, 'first', offsetPosition(ARENA_CENTER, 60));
    const second = addTestPlayer(world, 'second', offsetPosition(ARENA_CENTER, 120));
    tossHeldItem(thrower, world, CONFIG);
    updateItems(world, 0.02, CONFIG, random);
    // 맞으면 뒤로 날아간 뒤(airborne) 착지하면서 쓰러진다.
    expect(first.state).toBe('airborne');
    expect(second.state).toBe('free');
    expect(world.items.has(item.id)).toBe(false);
  });

  it('막기 중인 상대는 다운되지 않고 밀려나기만 한다', () => {
    const { world, thrower } = createThrowScene();
    const blocker = addTestPlayer(world, 'blocker', offsetPosition(ARENA_CENTER, 60));
    blocker.isBlocking = true;
    tossHeldItem(thrower, world, CONFIG);
    updateItems(world, 0.02, CONFIG, random);
    expect(blocker.state).toBe('free');
    expect(blocker.knockback.x).toBeCloseTo(CONFIG.block.pushbackSpeed);
  });

  it('던진 사람과 무적 상태의 상대는 통과한다', () => {
    const { world, thrower, item } = createThrowScene();
    const invincible = addTestPlayer(world, 'invincible', offsetPosition(ARENA_CENTER, 60));
    invincible.invincibleRemaining = 1;
    tossHeldItem(thrower, world, CONFIG);
    updateItems(world, 0.02, CONFIG, random);
    expect(invincible.state).toBe('free');
    expect(world.items.has(item.id)).toBe(true);
  });

  it('최대 거리를 날아가면 사라진다', () => {
    const { world, thrower, item } = createThrowScene();
    thrower.position = { x: CONFIG.arena.left, y: ARENA_CENTER.y };
    tossHeldItem(thrower, world, CONFIG);
    item.travelledDistance = CONFIG.item.throwMaxDistance;
    updateItems(world, 0.01, CONFIG, random);
    expect(world.items.has(item.id)).toBe(false);
  });

  it('경기장 밖으로 나가면 사라진다', () => {
    const { world, thrower, item } = createThrowScene();
    thrower.position = { x: CONFIG.arena.right, y: ARENA_CENTER.y };
    tossHeldItem(thrower, world, CONFIG);
    updateItems(world, 0.2, CONFIG, random);
    expect(world.items.has(item.id)).toBe(false);
  });
});

describe('updateItems — 들고 있는 아이템과 생성', () => {
  it('들고 있는 아이템은 들고 있는 사람을 따라다닌다', () => {
    const { world, thrower, item } = createThrowScene();
    thrower.position = offsetPosition(ARENA_CENTER, 50);
    updateItems(world, 0.01, CONFIG, random);
    expect(item.position).toEqual(thrower.position);
  });

  it('들고 있던 사람이 사라지면 바닥에 떨어진다', () => {
    const { world, thrower, item } = createThrowScene();
    world.players.delete(thrower.id);
    updateItems(world, 0.01, CONFIG, random);
    expect(item.state).toBe('floor');
  });

  it('바닥 아이템이 최대치보다 적으면 일정 시간마다 새로 생긴다', () => {
    const world = createTestWorld();
    updateItems(world, CONFIG.item.respawnSeconds - 0.1, CONFIG, random);
    expect(world.items.size).toBe(0);
    updateItems(world, 0.2, CONFIG, random);
    expect(world.items.size).toBe(1);
  });

  it('아이템이 최대치면 새로 생기지 않는다', () => {
    const world = createTestWorld();
    for (let index = 0; index < CONFIG.item.maxOnFloor; index += 1) {
      addTestItem(world, `item-${index}`, ARENA_CENTER);
    }
    updateItems(world, CONFIG.item.respawnSeconds * 2, CONFIG, random);
    expect(world.items.size).toBe(CONFIG.item.maxOnFloor);
    expect(world.itemSpawnElapsed).toBe(0);
  });

  it('들고 있거나 날아가는 아이템은 바닥 아이템 수에 넣지 않는다', () => {
    const world = createTestWorld();
    const holder = addTestPlayer(world, 'holder', ARENA_CENTER);
    addTestItem(world, 'held', ARENA_CENTER, { state: 'held', holderId: holder.id });
    holder.heldItemId = 'held';
    for (let index = 0; index < CONFIG.item.maxOnFloor; index += 1) {
      addTestItem(world, `flying-${index}`, offsetPosition(ARENA_CENTER, 300), { state: 'flying' });
    }
    updateItems(world, CONFIG.item.respawnSeconds + 0.1, CONFIG, random);
    expect([...world.items.values()].filter((item) => item.state === 'floor')).toHaveLength(1);
  });

  it('매치 시작 시 아이템을 초기 개수로 다시 깐다', () => {
    const { world, thrower } = createThrowScene();
    resetItems(world, CONFIG, random);
    expect(world.items.size).toBe(CONFIG.item.initialCount);
    expect(thrower.heldItemId).toBeNull();
  });
});
