import type { GameConfig } from '../game/game-config';
import type { ItemSnapshot, PlayerSnapshot } from '../game/protocol-types';
import type { AssetStore, CharacterPose } from './asset-store';
import type { ClientGameState } from './client-state';
import type { EffectsManager } from './effects-renderer';
import type { OwnPlayerPredictor } from './own-player-predictor';

import { drawAnswerZoneAreas, drawAnswerZoneLabels, drawArenaFloor, drawArenaShakeBackdrop } from './arena-renderer';
import { drawCeremony } from './ceremony-renderer';
import { CharacterLiftAnimator } from './character-lift-animator';
import { drawCharacter, resolveCharacterPose } from './character-renderer';
import { drawDizzyStars } from './effects-painter';
import { drawHud } from './hud-renderer';
import { drawFloorItems, FlyingItemRenderer } from './item-renderer';
import { drawLogWarnings, drawRollingLogs } from './log-renderer';
import { drawMeteors, drawMeteorWarnings } from './meteor-renderer';

const MOVING_DISTANCE_PER_FRAME = 0.6;
// 내 공격 자세는 키를 누를 때 바로 보여 주므로, 늦게 도착한 서버의 공격 상태로 다시 그리지 않는다.
const SELF_ACTION_STATES = new Set(['punching', 'kicking', 'tossing']);
const INVINCIBLE_BLINK_RATE = 12;

export interface SceneContext {
  ctx: CanvasRenderingContext2D;
  state: ClientGameState;
  config: GameConfig;
  assets: AssetStore;
  effects: EffectsManager;
  predictor: OwnPlayerPredictor;
  // 내 캐릭터는 키를 누르는 즉시 이 자세로 그린다(서버 응답을 기다리지 않음). null이면 서버 상태대로.
  selfPoseOverride: CharacterPose | null;
  now: number;
}

// 그리는 순서: 경기장 → 정답 구역 → 바닥 아이템 → 캐릭터(아래쪽이 앞) → 날아가는 아이템 → 효과 → 구역 라벨 → HUD
// 최종 순위 단계에서는 시상식 화면만 그린다.
export class SceneRenderer {
  private readonly previousPositions = new Map<string, { x: number; y: number }>();
  private readonly flyingItemRenderer = new FlyingItemRenderer();
  private readonly liftAnimator = new CharacterLiftAnimator();

  // 연결이 끊겼다 다시 붙을 때 부른다.
  reset(): void {
    this.liftAnimator.reset();
  }

  render(scene: SceneContext): void {
    const { ctx, state, config, assets, effects, now } = scene;
    const time = now / 1000;
    if (state.phase === 'final' && state.finalRankings) {
      drawCeremony(ctx, assets, state.finalRankings, (now - state.finalReceivedAt) / 1000, state.playerId);
      return;
    }
    const view = state.interpolator.getView(now);
    const players = this.applyPrediction(view.players, scene);
    const shake = effects.getShakeOffset(now);
    // 캔버스 출력이라 단위 테스트 대신 브라우저에서 확인했다.
    if (shake.x !== 0 || shake.y !== 0) {
      drawArenaShakeBackdrop(ctx, assets, config);
    }
    ctx.save();
    ctx.translate(shake.x, shake.y);
    drawArenaFloor(ctx, assets, config);
    drawAnswerZoneAreas(ctx, state.zones, state.judgement, (now - state.zonesReceivedAt) / 1000, time);
    drawFloorItems(ctx, assets, view.items);
    drawLogWarnings(ctx, view.logs, config, time);
    drawMeteorWarnings(ctx, view.meteors, config, time);
    [...players].sort((first, second) => first.y - second.y).forEach((player) => this.drawPlayer(scene, player, view.items, time));
    this.flyingItemRenderer.draw(ctx, assets, view.items, time);
    drawRollingLogs(ctx, view.logs, config, time);
    drawMeteors(ctx, view.meteors, config, time);
    effects.draw(ctx, now);
    drawAnswerZoneLabels(ctx, state.zones, state.judgement);
    ctx.restore();
    drawHud(ctx, state, players, now, config);
    this.rememberPositions(players);
  }

  private applyPrediction(players: PlayerSnapshot[], scene: SceneContext): PlayerSnapshot[] {
    const predicted = scene.predictor.getPosition();
    if (!predicted) {
      return players;
    }
    return players.map((player) => {
      if (player.id !== scene.state.playerId) {
        return player;
      }
      return { ...player, x: predicted.x, y: predicted.y, state: SELF_ACTION_STATES.has(player.state) ? 'free' : player.state };
    });
  }

  private drawPlayer(scene: SceneContext, player: PlayerSnapshot, items: ItemSnapshot[], time: number): void {
    const isSelf = player.id === scene.state.playerId;
    const previous = this.previousPositions.get(player.id) ?? player;
    const isMoving = Math.hypot(player.x - previous.x, player.y - previous.y) > MOVING_DISTANCE_PER_FRAME;
    const heldItem = player.heldItemId === null ? undefined : items.find((item) => item.id === player.heldItemId);
    const isBlinkHidden = player.isInvincible && Math.floor(time * INVINCIBLE_BLINK_RATE) % 2 === 0;
    drawCharacter(scene.ctx, scene.assets, {
      x: player.x,
      y: player.y,
      colorIndex: scene.state.roster.get(player.id)?.colorIndex ?? 0,
      pose: (isSelf ? scene.selfPoseOverride : null) ?? resolveCharacterPose(player, isMoving, time),
      facingSign: player.facingSign,
      time,
      scale: 1,
      lift: this.liftAnimator.computeLift(player, scene.now),
      struggle: player.state === 'grabbed' ? player.progress : undefined,
      label: scene.state.roster.get(player.id)?.nickname ?? '',
      isSelf,
      alpha: isBlinkHidden ? 0.45 : 1,
      heldItemKind: heldItem?.kind ?? null,
      flash: scene.effects.getFlashAmount(player.id, scene.now),
    });
    // 캔버스 출력이라 단위 테스트 대신 브라우저에서 확인했다.
    if (player.state === 'down') {
      drawDizzyStars(scene.ctx, player.x, player.y, time);
    }
  }

  private rememberPositions(players: PlayerSnapshot[]): void {
    this.previousPositions.clear();
    players.forEach((player) => this.previousPositions.set(player.id, { x: player.x, y: player.y }));
  }
}
