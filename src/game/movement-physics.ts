import type { GameConfig } from './game-config';
import type { PlayerEntity, PlayerInput, PlayerState, Vector } from './game-types';

import { clampNumber, getDistance, normalizeVector, scaleVector, ZERO_VECTOR } from './vector-math';

const SOLID_STATES: ReadonlySet<PlayerState> = new Set(['free', 'punching', 'kicking', 'lifting', 'tossing', 'stunned']);

export function readInputDirection(input: PlayerInput): Vector {
  const x = Number(input.isRightPressed) - Number(input.isLeftPressed);
  const y = Number(input.isDownPressed) - Number(input.isUpPressed);
  return normalizeVector({ x, y });
}

// 들고 있는 동안에도 걷고 방향을 바꿀 수 있어야 던질 방향을 고를 수 있다.
export function canPlayerMove(player: PlayerEntity): boolean {
  return player.state === 'free' || player.state === 'lifting';
}

function getMoveSpeedRatio(player: PlayerEntity, config: GameConfig): number {
  if (player.state === 'lifting') {
    return config.throwing.holdMoveSpeedRatio;
  }
  return player.isBlocking ? config.player.blockMoveSpeedRatio : 1;
}

export function computeMoveVelocity(player: PlayerEntity, config: GameConfig): Vector {
  if (!canPlayerMove(player)) {
    return { ...ZERO_VECTOR };
  }
  return scaleVector(readInputDirection(player.input), config.player.moveSpeed * getMoveSpeedRatio(player, config));
}

export function updatePlayerFacing(player: PlayerEntity): void {
  if (!canPlayerMove(player)) {
    return;
  }
  const direction = readInputDirection(player.input);
  if (direction.x === 0 && direction.y === 0) {
    return;
  }
  player.facing = direction;
  if (direction.x !== 0) {
    player.facingSign = direction.x > 0 ? 1 : -1;
  }
}

// 던져진(공중) 상태는 마찰 없이 날아가고, 그 외에는 넉백 속도가 지수적으로 줄어든다.
export function integratePlayerPosition(player: PlayerEntity, deltaSeconds: number, config: GameConfig): void {
  const moveVelocity = computeMoveVelocity(player, config);
  player.position.x += (moveVelocity.x + player.knockback.x) * deltaSeconds;
  player.position.y += (moveVelocity.y + player.knockback.y) * deltaSeconds;
  if (player.state !== 'airborne') {
    player.knockback = scaleVector(player.knockback, Math.exp(-config.player.knockbackFriction * deltaSeconds));
  }
  clampToArena(player.position, config);
}

export function clampToArena(position: Vector, config: GameConfig): void {
  const { left, right, top, bottom } = config.arena;
  position.x = clampNumber(position.x, left, right);
  position.y = clampNumber(position.y, top, bottom);
}

export function isSolidState(state: PlayerState): boolean {
  return SOLID_STATES.has(state);
}

export function isPlayerSolid(player: PlayerEntity): boolean {
  return isSolidState(player.state);
}

// 서 있는 캐릭터끼리 겹치면 서로 반씩 밀어낸다. 쓰러졌거나 공중에 있는 캐릭터는 통과한다.
export function resolvePlayerCollisions(players: PlayerEntity[], config: GameConfig): void {
  const minimumDistance = config.player.radius * 2;
  for (let firstIndex = 0; firstIndex < players.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex += 1) {
      const first = players[firstIndex];
      const second = players[secondIndex];
      if (!first || !second || !isPlayerSolid(first) || !isPlayerSolid(second)) {
        continue;
      }
      const distance = getDistance(first.position, second.position);
      if (distance >= minimumDistance) {
        continue;
      }
      const normal = normalizeVector({ x: second.position.x - first.position.x, y: second.position.y - first.position.y }, { x: 1, y: 0 });
      const push = (minimumDistance - distance) / 2;
      first.position.x -= normal.x * push;
      first.position.y -= normal.y * push;
      second.position.x += normal.x * push;
      second.position.y += normal.y * push;
      clampToArena(first.position, config);
      clampToArena(second.position, config);
    }
  }
}
