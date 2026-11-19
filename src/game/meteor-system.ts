import type { GameConfig } from './game-config';
import type { MeteorEntity, PlayerEntity, RandomSource, Vector, WorldState } from './game-types';

import { isPlayerHittable, launchPlayerBackward } from './combat-resolver';
import { getDistance, normalizeVector, subtractVectors } from './vector-math';

// 위치는 정답과 무관한 무작위다. 정답 칸을 기준으로 고르면 정답이 새어 나간다.
// 가로는 원이 경기장 안에 들어오게, 세로는 가운데 절반 안에서 고른다(원 지름이 경기장 높이보다 커서 세로는 거의 다 덮는다).
export function spawnMeteor(world: WorldState, config: GameConfig, random: RandomSource): MeteorEntity {
  const { left, right, top, bottom } = config.arena;
  const { radius } = config.meteor;
  const height = bottom - top;
  const meteor: MeteorEntity = {
    id: `meteor-${world.nextMeteorNumber}`,
    x: left + radius + random() * (right - left - radius * 2),
    y: top + height / 4 + random() * (height / 2),
    state: 'warning',
    stateElapsed: 0,
  };
  world.nextMeteorNumber += 1;
  world.meteors.set(meteor.id, meteor);
  return meteor;
}

export function updateMeteors(world: WorldState, deltaSeconds: number, config: GameConfig): void {
  [...world.meteors.values()].forEach((meteor) => {
    meteor.stateElapsed += deltaSeconds;
    if (meteor.state === 'warning' && meteor.stateElapsed >= config.meteor.warningSeconds) {
      strikeMeteor(meteor, world, config);
    } else if (meteor.state === 'impact' && meteor.stateElapsed >= config.meteor.impactSeconds) {
      world.meteors.delete(meteor.id);
    }
  });
}

// 맞을 사람을 먼저 모은 뒤 날려 보낸다. 잡기가 풀리는 순서에 따라 결과가 달라지지 않게 한다.
function strikeMeteor(meteor: MeteorEntity, world: WorldState, config: GameConfig): void {
  meteor.state = 'impact';
  meteor.stateElapsed = 0;
  const targets = [...world.players.values()].filter((player) => isPlayerHittable(player) && isInsideMeteorBlast(meteor, player.position, config));
  targets.forEach((player) => launchFromMeteor(meteor, player, world, config));
}

// 판정 원은 화면의 경고 원보다 캐릭터 반지름만큼 작다. 내 화면은 서버 판정보다 조금 앞서 보이므로 경계에서 억울하게 맞지 않게 한다.
export function isInsideMeteorBlast(meteor: MeteorEntity, position: Vector, config: GameConfig): boolean {
  return getDistance(meteor, position) <= config.meteor.radius - config.player.radius;
}

// 정중앙에 있으면 방향을 정할 수 없으므로 바라보던 방향으로 날아간다.
function launchFromMeteor(meteor: MeteorEntity, player: PlayerEntity, world: WorldState, config: GameConfig): void {
  const direction = normalizeVector(subtractVectors(player.position, meteor), player.facing);
  launchPlayerBackward(player, direction, world, config, config.meteor.launchSpeed, config.meteor.downSeconds);
}
