import type { GameConfig } from '../game/game-config';
import type { MatchState, MeteorEntity, PlayerEntity, WorldState } from '../game/game-types';
import type { ItemSnapshot, LogSnapshot, MeteorSnapshot, PlayerSnapshot, ServerMessage } from '../game/protocol-types';

import { getPhaseRemaining } from '../game/phase-scheduler';

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function toPlayerSnapshot(player: PlayerEntity): PlayerSnapshot {
  return {
    id: player.id,
    x: roundToTenth(player.position.x),
    y: roundToTenth(player.position.y),
    facingSign: player.facingSign,
    state: player.state,
    progress: player.stateDuration > 0 ? Math.round(Math.min(1, player.stateElapsed / player.stateDuration) * 100) / 100 : 0,
    isBlocking: player.isBlocking,
    isInvincible: player.invincibleRemaining > 0,
    heldItemId: player.heldItemId,
    score: player.score,
  };
}

function toMeteorSnapshot(meteor: MeteorEntity, config: GameConfig): MeteorSnapshot {
  const duration = meteor.state === 'warning' ? config.meteor.warningSeconds : config.meteor.impactSeconds;
  return {
    id: meteor.id,
    x: roundToTenth(meteor.x),
    y: roundToTenth(meteor.y),
    state: meteor.state,
    progress: Math.round(Math.min(1, meteor.stateElapsed / duration) * 100) / 100,
  };
}

export function buildSnapshotMessage(world: WorldState, match: MatchState, serverTime: number, config: GameConfig): ServerMessage {
  const items: ItemSnapshot[] = [...world.items.values()].map((item) => ({
    id: item.id,
    kind: item.kind,
    x: roundToTenth(item.position.x),
    y: roundToTenth(item.position.y),
    state: item.state,
  }));
  const logs: LogSnapshot[] = [...world.logs.values()].map((log) => ({
    id: log.id,
    x: roundToTenth(log.x),
    y: roundToTenth(log.y),
    direction: log.direction,
    state: log.state,
  }));
  return {
    type: 'snapshot',
    serverTime,
    phase: match.phase,
    phaseRemaining: roundToTenth(getPhaseRemaining(match)),
    players: [...world.players.values()].map(toPlayerSnapshot),
    items,
    logs,
    meteors: [...world.meteors.values()].map((meteor) => toMeteorSnapshot(meteor, config)),
  };
}
