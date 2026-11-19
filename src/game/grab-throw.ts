import type { GameConfig } from './game-config';
import type { PlayerEntity, WorldState } from './game-types';

import { isPlayerHittable } from './combat-resolver';
import { clampToArena, readInputDirection } from './movement-physics';
import { interruptPlayer, setPlayerFree, setPlayerState } from './player-interrupt';
import { getDotProduct, getVectorLength, scaleVector, subtractVectors } from './vector-math';

// 몸이 닿을 만큼 가까운 상대 중, 누르고 있는 방향키 쪽에 있는 가장 가까운 상대를 찾는다.
export function findGrabTarget(player: PlayerEntity, world: WorldState, config: GameConfig): PlayerEntity | null {
  const direction = readInputDirection(player.input);
  if (direction.x === 0 && direction.y === 0) {
    return null;
  }
  let nearestTarget: PlayerEntity | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  world.players.forEach((target) => {
    if (target.id === player.id || !isPlayerHittable(target)) {
      return;
    }
    const offset = subtractVectors(target.position, player.position);
    const distance = getVectorLength(offset);
    const isInFront = distance > 0 && getDotProduct(scaleVector(offset, 1 / distance), direction) >= config.throwing.directionDotThreshold;
    if (distance <= config.throwing.contactDistance && isInFront && distance < nearestDistance) {
      nearestTarget = target;
      nearestDistance = distance;
    }
  });
  return nearestTarget;
}

export function startGrab(thrower: PlayerEntity, target: PlayerEntity, world: WorldState, config: GameConfig): void {
  interruptPlayer(target, world, config);
  // 든 사람은 언제나 맞고 잡힐 수 있어야 동료가 구해 줄 수 있다. 일어난 직후 등의 무적은 여기서 끝난다.
  thrower.invincibleRemaining = 0;
  setPlayerState(thrower, 'lifting', config.throwing.holdSeconds);
  thrower.grabbedTargetId = target.id;
  setPlayerState(target, 'grabbed', config.throwing.holdSeconds);
  target.grabbedById = thrower.id;
  target.knockback = { x: 0, y: 0 };
}

// 들린 사람은 든 사람과 같은 자리에 있고, 화면에서만 머리 위로 올려 그린다. 1만큼 아래에 두어 든 사람보다 나중에(앞에) 그려지게 한다(맨 아래 벽에서는 같아져도 높이가 달라 겹치지 않는다).
export function holdGrabbedTarget(thrower: PlayerEntity, world: WorldState, config: GameConfig): void {
  const target = thrower.grabbedTargetId === null ? undefined : world.players.get(thrower.grabbedTargetId);
  if (!target) {
    return;
  }
  target.position = { x: thrower.position.x, y: thrower.position.y + 1 };
  clampToArena(target.position, config);
}

// 다시 Z를 누르면 던진다. 잡자마자 연타로 던져지지 않게 잠깐은 무시한다.
export function handleLiftingPunchPress(thrower: PlayerEntity, world: WorldState, config: GameConfig): void {
  if (thrower.stateElapsed >= config.throwing.minHoldSeconds) {
    launchGrabbedTarget(thrower, world, config);
    setPlayerFree(thrower);
  }
}

// 바라보는 방향으로 던진다. 들린 사람은 공중 상태가 되고 착지하면 다운된다.
export function launchGrabbedTarget(thrower: PlayerEntity, world: WorldState, config: GameConfig): void {
  const target = thrower.grabbedTargetId === null ? undefined : world.players.get(thrower.grabbedTargetId);
  thrower.grabbedTargetId = null;
  if (!target || target.state !== 'grabbed') {
    return;
  }
  target.grabbedById = null;
  setPlayerState(target, 'airborne', config.throwing.airborneSeconds);
  target.knockback = scaleVector(thrower.facing, config.throwing.airborneSpeed);
  target.facingSign = thrower.facingSign === 1 ? -1 : 1;
}
