import type { GameConfig } from './game-config';
import type { RandomSource, WorldState } from './game-types';

import { processPlayerActions } from './action-dispatcher';
import { applyStrikeHit, collectStrikeHits } from './combat-resolver';
import { holdGrabbedTarget } from './grab-throw';
import { updateItems } from './item-system';
import { updateMeteors } from './meteor-system';
import { integratePlayerPosition, resolvePlayerCollisions, updatePlayerFacing } from './movement-physics';
import { updatePlayerTimers } from './player-state-timer';
import { updateRollingLogs } from './rolling-log-system';

export function createWorld(firstLogDelaySeconds = 12): WorldState {
  return {
    time: 0,
    players: new Map(),
    items: new Map(),
    nextItemNumber: 1,
    itemSpawnElapsed: 0,
    logs: new Map(),
    nextLogNumber: 1,
    logSpawnRemaining: firstLogDelaySeconds,
    meteors: new Map(),
    nextMeteorNumber: 1,
  };
}

// 서버 틱 1회.
// 순서: 방향 → 버튼 입력 → 상태 타이머 → 타격 판정 → 이동 → 충돌 → 들린 사람 위치 → 아이템 → 통나무 → 메테오
export function stepWorld(world: WorldState, deltaSeconds: number, config: GameConfig, random: RandomSource): void {
  const players = [...world.players.values()];
  players.forEach((player) => {
    updatePlayerFacing(player);
    processPlayerActions(player, world, config);
  });
  players.forEach((player) => updatePlayerTimers(player, world, deltaSeconds, config));
  const strikeHits = players.flatMap((player) => collectStrikeHits(player, world, config));
  strikeHits.forEach((hit) => applyStrikeHit(hit.attacker, hit.target, hit.kind, world, config));
  players.forEach((player) => {
    if (player.state !== 'grabbed') {
      integratePlayerPosition(player, deltaSeconds, config);
    }
  });
  resolvePlayerCollisions(players, config);
  players.forEach((player) => {
    if (player.state === 'lifting') {
      holdGrabbedTarget(player, world, config);
    }
  });
  updateItems(world, deltaSeconds, config, random);
  updateRollingLogs(world, deltaSeconds, config, random);
  updateMeteors(world, deltaSeconds, config);
  world.time += deltaSeconds;
}
