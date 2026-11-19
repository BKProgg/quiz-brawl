import type { GameConfig } from './game-config';
import type { PlayerEntity, PlayerInput, RandomSource, Vector } from './game-types';

export function createEmptyInput(): PlayerInput {
  return {
    isUpPressed: false,
    isDownPressed: false,
    isLeftPressed: false,
    isRightPressed: false,
    isBlockPressed: false,
    punchCount: 0,
    kickCount: 0,
  };
}

export function createPlayer(id: string, nickname: string, colorIndex: number, position: Vector): PlayerEntity {
  return {
    id,
    nickname,
    colorIndex,
    position: { ...position },
    knockback: { x: 0, y: 0 },
    facing: { x: 1, y: 0 },
    facingSign: 1,
    state: 'free',
    stateElapsed: 0,
    stateDuration: 0,
    landingDownSeconds: null,
    hasAttackResolved: false,
    isBlocking: false,
    recentHitTimes: [],
    invincibleRemaining: 0,
    heldItemId: null,
    grabbedTargetId: null,
    grabbedById: null,
    score: 0,
    input: createEmptyInput(),
    handledPunchCount: 0,
    handledKickCount: 0,
  };
}

export function pickRandomArenaPosition(config: GameConfig, random: RandomSource, margin: number): Vector {
  const { left, right, top, bottom } = config.arena;
  return {
    x: left + margin + random() * (right - left - margin * 2),
    y: top + margin + random() * (bottom - top - margin * 2),
  };
}
