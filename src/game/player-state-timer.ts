import type { GameConfig } from './game-config';
import type { PlayerEntity, WorldState } from './game-types';

import { knockDownPlayer } from './combat-resolver';
import { freeGrabbedPlayer, releaseGrab, setPlayerFree } from './player-interrupt';
import { scaleVector } from './vector-math';

const LANDING_KNOCKBACK_RATIO = 0.2;

export function updatePlayerTimers(player: PlayerEntity, world: WorldState, deltaSeconds: number, config: GameConfig): void {
  player.invincibleRemaining = Math.max(0, player.invincibleRemaining - deltaSeconds);
  if (player.state === 'free') {
    return;
  }
  player.stateElapsed += deltaSeconds;
  if (player.state === 'grabbed') {
    releaseOrphanedGrab(player, world, config);
    return;
  }
  if (player.stateElapsed >= player.stateDuration) {
    finishPlayerState(player, world, config);
  }
}

// 잡힌 상태는 든 사람이 끝내 준다. 든 사람이 사라졌거나 더 이상 들고 있지 않으면 풀어 준다.
function releaseOrphanedGrab(player: PlayerEntity, world: WorldState, config: GameConfig): void {
  const thrower = player.grabbedById === null ? undefined : world.players.get(player.grabbedById);
  if (!thrower || thrower.grabbedTargetId !== player.id) {
    freeGrabbedPlayer(player, config);
  }
}

function finishPlayerState(player: PlayerEntity, world: WorldState, config: GameConfig): void {
  switch (player.state) {
    case 'lifting':
      releaseGrab(player, world, config);
      setPlayerFree(player);
      break;
    case 'airborne':
      player.knockback = scaleVector(player.knockback, LANDING_KNOCKBACK_RATIO);
      knockDownPlayer(player, world, config);
      break;
    case 'down':
      setPlayerFree(player);
      player.invincibleRemaining = config.down.invincibleSeconds;
      break;
    default:
      setPlayerFree(player);
  }
}
