import type { GameConfig } from './game-config';
import type { ItemEntity, PlayerEntity, RandomSource, WorldState } from './game-types';

import { isPlayerHittable, launchPlayerBackward } from './combat-resolver';
import { pickRandomArenaPosition } from './player-factory';
import { setPlayerState } from './player-interrupt';
import { getDistance, getVectorLength, normalizeVector, scaleVector } from './vector-math';

export function spawnItem(world: WorldState, config: GameConfig, random: RandomSource): ItemEntity {
  const item: ItemEntity = {
    id: `item-${world.nextItemNumber}`,
    kind: Math.floor(random() * config.item.kindCount),
    position: pickRandomArenaPosition(config, random, config.item.radius * 2),
    state: 'floor',
    holderId: null,
    velocity: { x: 0, y: 0 },
    thrownById: null,
    travelledDistance: 0,
  };
  world.nextItemNumber += 1;
  world.items.set(item.id, item);
  return item;
}

export function resetItems(world: WorldState, config: GameConfig, random: RandomSource): void {
  world.items.clear();
  world.itemSpawnElapsed = 0;
  world.players.forEach((player) => {
    player.heldItemId = null;
  });
  for (let count = 0; count < config.item.initialCount; count += 1) {
    spawnItem(world, config, random);
  }
}

export function findPickupItem(player: PlayerEntity, world: WorldState, config: GameConfig): ItemEntity | null {
  let nearestItem: ItemEntity | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  world.items.forEach((item) => {
    const distance = getDistance(item.position, player.position);
    if (item.state === 'floor' && distance <= config.item.pickupDistance && distance < nearestDistance) {
      nearestItem = item;
      nearestDistance = distance;
    }
  });
  return nearestItem;
}

export function pickUpItem(player: PlayerEntity, item: ItemEntity): void {
  item.state = 'held';
  item.holderId = player.id;
  player.heldItemId = item.id;
}

export function tossHeldItem(player: PlayerEntity, world: WorldState, config: GameConfig): void {
  const item = player.heldItemId === null ? undefined : world.items.get(player.heldItemId);
  player.heldItemId = null;
  if (!item) {
    return;
  }
  item.state = 'flying';
  item.holderId = null;
  item.thrownById = player.id;
  item.travelledDistance = 0;
  item.velocity = scaleVector(player.facing, config.item.throwSpeed);
  item.position = { x: player.position.x + player.facing.x * config.player.radius, y: player.position.y + player.facing.y * config.player.radius };
  setPlayerState(player, 'tossing', config.item.tossSeconds);
}

export function updateItems(world: WorldState, deltaSeconds: number, config: GameConfig, random: RandomSource): void {
  [...world.items.values()].forEach((item) => {
    if (item.state === 'held') {
      followHolder(item, world);
    } else if (item.state === 'flying') {
      moveFlyingItem(item, world, deltaSeconds, config);
    }
  });
  updateItemSpawn(world, deltaSeconds, config, random);
}

function followHolder(item: ItemEntity, world: WorldState): void {
  const holder = item.holderId === null ? undefined : world.players.get(item.holderId);
  if (!holder || holder.heldItemId !== item.id) {
    item.state = 'floor';
    item.holderId = null;
    return;
  }
  item.position = { ...holder.position };
}

// 던진 아이템은 직선으로 날아가 처음 맞은 상대 1명을 뒤로 날려 쓰러뜨리고 사라진다.
function moveFlyingItem(item: ItemEntity, world: WorldState, deltaSeconds: number, config: GameConfig): void {
  const step = scaleVector(item.velocity, deltaSeconds);
  item.position = { x: item.position.x + step.x, y: item.position.y + step.y };
  item.travelledDistance += getVectorLength(step);
  if (isOutsideArena(item, config) || item.travelledDistance >= config.item.throwMaxDistance) {
    world.items.delete(item.id);
    return;
  }
  const target = findItemTarget(item, world, config);
  if (target) {
    hitPlayerWithItem(target, item, world, config);
    world.items.delete(item.id);
  }
}

function isOutsideArena(item: ItemEntity, config: GameConfig): boolean {
  const { left, right, top, bottom } = config.arena;
  const margin = config.player.radius;
  const { x, y } = item.position;
  return x < left - margin || x > right + margin || y < top - margin || y > bottom + margin;
}

function findItemTarget(item: ItemEntity, world: WorldState, config: GameConfig): PlayerEntity | null {
  let nearestTarget: PlayerEntity | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  world.players.forEach((player) => {
    const distance = getDistance(player.position, item.position);
    const isTouching = distance <= config.player.radius + config.item.radius;
    if (player.id !== item.thrownById && isPlayerHittable(player) && isTouching && distance < nearestDistance) {
      nearestTarget = player;
      nearestDistance = distance;
    }
  });
  return nearestTarget;
}

function hitPlayerWithItem(target: PlayerEntity, item: ItemEntity, world: WorldState, config: GameConfig): void {
  const direction = normalizeVector(item.velocity, { x: 1, y: 0 });
  if (target.isBlocking) {
    target.knockback = scaleVector(direction, config.block.pushbackSpeed);
    return;
  }
  launchPlayerBackward(target, direction, world, config);
}

// 들고 있거나 날아가는 아이템은 빼고 바닥에 놓인 아이템 수만 센다.
function updateItemSpawn(world: WorldState, deltaSeconds: number, config: GameConfig, random: RandomSource): void {
  const floorItemCount = [...world.items.values()].filter((item) => item.state === 'floor').length;
  if (floorItemCount >= config.item.maxOnFloor) {
    world.itemSpawnElapsed = 0;
    return;
  }
  world.itemSpawnElapsed += deltaSeconds;
  if (world.itemSpawnElapsed >= config.item.respawnSeconds) {
    world.itemSpawnElapsed = 0;
    spawnItem(world, config, random);
  }
}
