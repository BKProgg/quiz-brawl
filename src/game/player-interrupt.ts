import type { GameConfig } from './game-config';
import type { PlayerEntity, WorldState } from './game-types';

export function setPlayerState(player: PlayerEntity, state: PlayerEntity['state'], durationSeconds: number): void {
  player.state = state;
  player.stateElapsed = 0;
  player.stateDuration = durationSeconds;
}

export function setPlayerFree(player: PlayerEntity): void {
  setPlayerState(player, 'free', 0);
}

export function dropHeldItem(player: PlayerEntity, world: WorldState): void {
  if (player.heldItemId === null) {
    return;
  }
  const item = world.items.get(player.heldItemId);
  player.heldItemId = null;
  if (!item) {
    return;
  }
  item.state = 'floor';
  item.holderId = null;
  item.position = { ...player.position };
}

// 들려 있던 사람이 그 자리에 안전하게 내려온다. 잠깐 무적이라 바로 다시 잡히거나 맞지 않는다.
export function freeGrabbedPlayer(target: PlayerEntity, config: GameConfig): void {
  target.grabbedById = null;
  setPlayerFree(target);
  target.invincibleRemaining = config.throwing.releaseInvincibleSeconds;
}

// 들고 있던 상대를 놓아준다.
export function releaseGrab(player: PlayerEntity, world: WorldState, config: GameConfig): void {
  if (player.grabbedTargetId === null) {
    return;
  }
  const target = world.players.get(player.grabbedTargetId);
  player.grabbedTargetId = null;
  if (target?.state === 'grabbed') {
    freeGrabbedPlayer(target, config);
  }
}

// 맞거나 잡혀서 행동이 끊길 때, 들고 있던 아이템과 잡고 있던 상대를 모두 놓는다.
export function interruptPlayer(player: PlayerEntity, world: WorldState, config: GameConfig): void {
  dropHeldItem(player, world);
  releaseGrab(player, world, config);
  player.isBlocking = false;
}
