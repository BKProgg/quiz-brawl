import type { GameConfig } from './game-config';
import type { LogEntity, RandomSource, WorldState } from './game-types';

import { isPlayerHittable, launchPlayerBackward } from './combat-resolver';

// 거대한 통나무가 10~20초마다 왼쪽 또는 오른쪽 벽 밖에서 굴러 나와 반대편까지 가로지른다.
// 나오기 전 잠깐 경고 상태로 벽에 표시되고, 맞은 사람은 통나무 방향으로 날아가 쓰러진다. 막기로는 못 막는다.
export function updateRollingLogs(world: WorldState, deltaSeconds: number, config: GameConfig, random: RandomSource): void {
  world.logSpawnRemaining -= deltaSeconds;
  if (world.logSpawnRemaining <= 0) {
    spawnLog(world, config, random);
    world.logSpawnRemaining = pickSpawnInterval(config, random);
  }
  [...world.logs.values()].forEach((log) => {
    if (log.state === 'warning') {
      advanceWarning(log, deltaSeconds, config);
    } else {
      rollLog(log, world, deltaSeconds, config);
    }
  });
}

export function pickSpawnInterval(config: GameConfig, random: RandomSource): number {
  const { minIntervalSeconds, maxIntervalSeconds } = config.log;
  return minIntervalSeconds + random() * (maxIntervalSeconds - minIntervalSeconds);
}

export function spawnLog(world: WorldState, config: GameConfig, random: RandomSource): LogEntity {
  const { left, right, top, bottom } = config.arena;
  const direction = random() < 0.5 ? 1 : -1;
  const margin = config.log.halfLength;
  const log: LogEntity = {
    id: `log-${world.nextLogNumber}`,
    x: direction === 1 ? left - config.log.radius * 2 : right + config.log.radius * 2,
    y: top + margin + random() * (bottom - top - margin * 2),
    direction,
    state: 'warning',
    warningElapsed: 0,
  };
  world.nextLogNumber += 1;
  world.logs.set(log.id, log);
  return log;
}

function advanceWarning(log: LogEntity, deltaSeconds: number, config: GameConfig): void {
  log.warningElapsed += deltaSeconds;
  if (log.warningElapsed >= config.log.warningSeconds) {
    log.state = 'rolling';
  }
}

function rollLog(log: LogEntity, world: WorldState, deltaSeconds: number, config: GameConfig): void {
  log.x += log.direction * config.log.speed * deltaSeconds;
  const { left, right } = config.arena;
  const exitMargin = config.log.radius * 3;
  if (log.x < left - exitMargin || log.x > right + exitMargin) {
    world.logs.delete(log.id);
    return;
  }
  world.players.forEach((player) => {
    if (isPlayerHittable(player) && isTouchingLog(log, player.position, config)) {
      launchPlayerBackward(player, { x: log.direction, y: 0 }, world, config, config.log.launchSpeed);
    }
  });
}

// 통나무는 세로로 긴 원통이라 가로는 굵기(radius), 세로는 길이(halfLength)로 판정한다.
export function isTouchingLog(log: LogEntity, position: { x: number; y: number }, config: GameConfig): boolean {
  const reachX = config.log.radius + config.player.radius;
  const reachY = config.log.halfLength + config.player.radius * 0.6;
  return Math.abs(position.x - log.x) <= reachX && Math.abs(position.y - log.y) <= reachY;
}
