import type { GameConfig } from './game-config';
import type { PlayerEntity, PlayerState, Vector, WorldState } from './game-types';

import { interruptPlayer, setPlayerState } from './player-interrupt';
import { addVectors, getDistance, normalizeVector, scaleVector, subtractVectors } from './vector-math';

export type StrikeKind = 'punch' | 'kick';
export type StrikeResult = 'ignored' | 'blocked' | 'stunned' | 'down';

const UNHITTABLE_STATES: ReadonlySet<PlayerState> = new Set(['airborne', 'down', 'grabbed']);

export function isPlayerHittable(player: PlayerEntity): boolean {
  return player.invincibleRemaining <= 0 && !UNHITTABLE_STATES.has(player.state);
}

export function startStrike(player: PlayerEntity, kind: StrikeKind, config: GameConfig): void {
  setPlayerState(player, kind === 'punch' ? 'punching' : 'kicking', config[kind].durationSeconds);
  player.hasAttackResolved = false;
}

function getStrikeKind(player: PlayerEntity): StrikeKind | null {
  if (player.state === 'punching') {
    return 'punch';
  }
  return player.state === 'kicking' ? 'kick' : null;
}

export interface StrikeHit {
  attacker: PlayerEntity;
  target: PlayerEntity;
  kind: StrikeKind;
}

// 공격 동작이 타격 시점(hitTimeSeconds)에 도달하면 한 번만 맞을 대상을 모은다.
// 같은 틱의 공격을 모두 모은 뒤 한꺼번에 적용해야 동시에 때린 두 사람이 서로 맞는다.
// 발차기가 빗나가면 빈틈(후딜)이 늘어난다.
export function collectStrikeHits(attacker: PlayerEntity, world: WorldState, config: GameConfig): StrikeHit[] {
  const kind = getStrikeKind(attacker);
  if (kind === null || attacker.hasAttackResolved || attacker.stateElapsed < config[kind].hitTimeSeconds) {
    return [];
  }
  attacker.hasAttackResolved = true;
  const strike = config[kind];
  const hitPoint = addVectors(attacker.position, scaleVector(attacker.facing, strike.range));
  const hits = [...world.players.values()]
    .filter((target) => target.id !== attacker.id && isPlayerHittable(target))
    .filter((target) => getDistance(target.position, hitPoint) <= config.player.radius + strike.hitRadius)
    .map((target) => ({ attacker, target, kind }));
  if (kind === 'kick' && hits.length === 0) {
    attacker.stateDuration += config.kick.missRecoverySeconds;
  }
  return hits;
}

export function applyStrikeHit(attacker: PlayerEntity, target: PlayerEntity, kind: StrikeKind, world: WorldState, config: GameConfig): StrikeResult {
  if (!isPlayerHittable(target)) {
    return 'ignored';
  }
  const direction = normalizeVector(subtractVectors(target.position, attacker.position), attacker.facing);
  if (target.isBlocking) {
    target.knockback = scaleVector(direction, config.block.pushbackSpeed);
    return 'blocked';
  }
  interruptPlayer(target, world, config);
  target.knockback = scaleVector(direction, config[kind].knockbackSpeed);
  if (registerHit(target, world.time, config)) {
    launchPlayerBackward(target, direction, world, config);
    return 'down';
  }
  setPlayerState(target, 'stunned', config[kind].stunSeconds);
  return 'stunned';
}

// 최근 피격 시각을 기록하고, 다운 조건(일정 시간 안에 N회)에 도달했는지 돌려준다.
export function registerHit(player: PlayerEntity, time: number, config: GameConfig): boolean {
  player.recentHitTimes = player.recentHitTimes.filter((hitTime) => time - hitTime <= config.down.hitWindowSeconds);
  player.recentHitTimes.push(time);
  return player.recentHitTimes.length >= config.down.hitCount;
}

// 맞은 방향으로 붕 날려 보낸다(공중 상태). 착지하면 다운된다. 날아가는 동안 때린 쪽을 바라본다.
// downSeconds를 주면 착지 후 그 시간만큼 쓰러져 있고, 없으면 기본 다운 시간을 쓴다.
export function launchPlayerBackward(
  target: PlayerEntity,
  direction: Vector,
  world: WorldState,
  config: GameConfig,
  speed: number = config.knockdownLaunch.speed,
  downSeconds: number | null = null,
): void {
  interruptPlayer(target, world, config);
  target.recentHitTimes = [];
  target.landingDownSeconds = downSeconds;
  setPlayerState(target, 'airborne', config.knockdownLaunch.airborneSeconds);
  target.knockback = scaleVector(direction, speed);
  if (direction.x !== 0) {
    target.facingSign = direction.x > 0 ? -1 : 1;
  }
}

export function knockDownPlayer(player: PlayerEntity, world: WorldState, config: GameConfig): void {
  interruptPlayer(player, world, config);
  setPlayerState(player, 'down', player.landingDownSeconds ?? config.down.durationSeconds);
  player.landingDownSeconds = null;
  player.recentHitTimes = [];
}
