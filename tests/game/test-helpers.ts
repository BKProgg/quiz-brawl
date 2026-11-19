import type { ItemEntity, PlayerEntity, PlayerInput, RandomSource, Vector, WorldState } from '../../src/game/game-types';

import { GAME_CONFIG } from '../../src/game/game-config';
import { createPlayer } from '../../src/game/player-factory';
import { createWorld } from '../../src/game/world-simulation';

export const CONFIG = GAME_CONFIG;
export const ARENA_CENTER: Vector = { x: 800, y: 480 };

export function createSeededRandom(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

export function addTestPlayer(world: WorldState, id: string, position: Vector, input: Partial<PlayerInput> = {}): PlayerEntity {
  const player = createPlayer(id, id, world.players.size, position);
  Object.assign(player.input, input);
  world.players.set(id, player);
  return player;
}

export function addTestItem(world: WorldState, id: string, position: Vector, overrides: Partial<ItemEntity> = {}): ItemEntity {
  const item: ItemEntity = {
    id,
    kind: 0,
    position: { ...position },
    state: 'floor',
    holderId: null,
    velocity: { x: 0, y: 0 },
    thrownById: null,
    travelledDistance: 0,
    ...overrides,
  };
  world.items.set(id, item);
  return item;
}

export function createTestWorld(): WorldState {
  return createWorld();
}

export function offsetPosition(position: Vector, deltaX: number, deltaY = 0): Vector {
  return { x: position.x + deltaX, y: position.y + deltaY };
}
