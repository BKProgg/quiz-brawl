import type { PlayerState } from '../game/game-types';
import type { MeteorSnapshot, PlayerSnapshot } from '../game/protocol-types';
import type { Judgement } from './client-state';

import { drawDustCloud, drawScorePopup, drawShockwave, drawSparkBurst } from './effects-painter';

type EffectKind = 'spark' | 'shockwave' | 'dust' | 'scorePopup';

interface ActiveEffect {
  kind: EffectKind;
  x: number;
  y: number;
  startedAt: number;
  durationMilliseconds: number;
  strength: number;
  text: string;
}

interface HitIntensity {
  spark: number;
  shake: number;
}

const FLASH_MILLISECONDS = 140;
const SHAKE_MILLISECONDS = 260;
const LIGHT_HIT = { spark: 1, shake: 3 };
const HEAVY_HIT = { spark: 1.7, shake: 9 };
const LANDING_SHAKE = 7;
const METEOR_SHAKE = 18;

// 상태 변화로 맞은 순간을 감지해 타격감 효과를 낸다. 글자 효과 없이 번쩍임·불꽃·충격파·먼지·화면 흔들림만 쓴다.
// - 가볍게 맞음(경직): 번쩍 + 작은 불꽃 + 약한 흔들림
// - 날아감(물건·연타 다운): 번쩍 + 큰 불꽃 + 충격파 + 강한 흔들림
// - 착지(공중 → 다운): 흙먼지 + 바닥 충격파 + 흔들림
// 화면 흔들림은 내가 맞았을 때와 메테오가 떨어질 때만 낸다. 다른 사람 타격까지 흔들면 10명 난투에서 화면이 계속 흔들려 문제를 읽기 어렵다.
export class EffectsManager {
  private readonly previousStates = new Map<string, PlayerState>();
  private readonly flashStartedAt = new Map<string, number>();
  private effects: ActiveEffect[] = [];
  private shakeStartedAt = Number.NEGATIVE_INFINITY;
  private shakeStrength = 0;
  private lastJudgementAt = Number.NEGATIVE_INFINITY;
  private impactedMeteorIds = new Set<string>();

  // 관리자 화면처럼 내 캐릭터가 없으면 ownPlayerId는 null이다.
  observePlayers(players: PlayerSnapshot[], ownPlayerId: string | null, now: number): void {
    players.forEach((player) => {
      const previous = this.previousStates.get(player.id);
      this.previousStates.set(player.id, player.state);
      if (previous !== undefined && previous !== player.state) {
        this.reactToStateChange(player, previous, player.id === ownPlayerId, now);
      }
    });
  }

  // 끊겼다 다시 붙으면 끊기기 전 상태와 비교해 가짜 타격 효과가 나지 않게 기억을 지운다.
  reset(): void {
    this.previousStates.clear();
    this.flashStartedAt.clear();
    this.impactedMeteorIds.clear();
  }

  // 메테오가 땅에 닿는 순간 맞은 사람이 없어도 화면을 크게 흔든다.
  observeMeteors(meteors: MeteorSnapshot[], now: number): void {
    const impactedIds = new Set(meteors.filter((meteor) => meteor.state === 'impact').map((meteor) => meteor.id));
    if ([...impactedIds].some((id) => !this.impactedMeteorIds.has(id))) {
      this.shake(now, METEOR_SHAKE);
    }
    this.impactedMeteorIds = impactedIds;
  }

  observeJudgement(judgement: Judgement | null, players: PlayerSnapshot[], points: number, now: number): void {
    if (!judgement || judgement.receivedAt === this.lastJudgementAt) {
      return;
    }
    this.lastJudgementAt = judgement.receivedAt;
    players.filter((player) => judgement.scorerIds.includes(player.id)).forEach((player) => {
      this.add('scorePopup', player.x, player.y - 120, now, 1200, 1, `+${points}`);
    });
  }

  // 맞은 직후 캐릭터를 하얗게 번쩍이게 할 세기(0~1).
  getFlashAmount(playerId: string, now: number): number {
    const startedAt = this.flashStartedAt.get(playerId);
    if (startedAt === undefined) {
      return 0;
    }
    return Math.max(0, 1 - (now - startedAt) / FLASH_MILLISECONDS);
  }

  getShakeOffset(now: number): { x: number; y: number } {
    const elapsed = now - this.shakeStartedAt;
    if (elapsed > SHAKE_MILLISECONDS) {
      return { x: 0, y: 0 };
    }
    const strength = this.shakeStrength * (1 - elapsed / SHAKE_MILLISECONDS);
    return { x: Math.sin(now * 0.11) * strength, y: Math.cos(now * 0.09) * strength };
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    this.effects = this.effects.filter((effect) => now - effect.startedAt < effect.durationMilliseconds);
    this.effects.forEach((effect) => {
      // 효과는 메시지를 받은 시각에 시작하고 그리는 시각은 프레임 시각이라, 프레임 시각이 조금 앞설 수 있다.
      // 진행도가 음수가 되면 반지름이 음수가 되어 캔버스가 예외를 던지므로 0 아래로 내리지 않는다.
      const progress = Math.max(0, (now - effect.startedAt) / effect.durationMilliseconds);
      const frame = { x: effect.x, y: effect.y, progress, strength: effect.strength };
      if (effect.kind === 'spark') {
        drawSparkBurst(ctx, frame);
      } else if (effect.kind === 'shockwave') {
        drawShockwave(ctx, frame);
      } else if (effect.kind === 'dust') {
        drawDustCloud(ctx, frame);
      } else {
        drawScorePopup(ctx, frame, effect.text);
      }
    });
  }

  private reactToStateChange(player: PlayerSnapshot, previous: PlayerState, isOwnPlayer: boolean, now: number): void {
    if (player.state === 'stunned') {
      this.hit(player, now, LIGHT_HIT, 220, isOwnPlayer);
    } else if (player.state === 'airborne' && previous !== 'grabbed') {
      this.hit(player, now, HEAVY_HIT, 320, isOwnPlayer);
      this.add('shockwave', player.x, player.y - 50, now, 320, 1.2, '');
    } else if (player.state === 'down') {
      this.add('dust', player.x, player.y, now, 600, previous === 'airborne' ? 1.3 : 1, '');
      this.add('shockwave', player.x, player.y, now, 420, 1.4, '');
      if (isOwnPlayer) {
        this.shake(now, previous === 'airborne' ? LANDING_SHAKE : LIGHT_HIT.shake);
      }
    }
  }

  private hit(player: PlayerSnapshot, now: number, intensity: HitIntensity, durationMilliseconds: number, isOwnPlayer: boolean): void {
    this.flashStartedAt.set(player.id, now);
    this.add('spark', player.x, player.y - 55, now, durationMilliseconds, intensity.spark, '');
    if (isOwnPlayer) {
      this.shake(now, intensity.shake);
    }
  }

  private shake(now: number, strength: number): void {
    // 처음에는 경과 시간이 무한대라 0 × -무한대 = NaN이 되지 않도록 남은 비율을 0 아래로 내리지 않는다.
    const remainingRatio = Math.max(0, 1 - (now - this.shakeStartedAt) / SHAKE_MILLISECONDS);
    if (strength >= this.shakeStrength * remainingRatio) {
      this.shakeStartedAt = now;
      this.shakeStrength = strength;
    }
  }

  private add(kind: EffectKind, x: number, y: number, now: number, durationMilliseconds: number, strength: number, text: string): void {
    this.effects.push({ kind, x, y, startedAt: now, durationMilliseconds, strength, text });
  }
}
