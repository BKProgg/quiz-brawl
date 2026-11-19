import type { RankingEntry } from '../game/game-types';
import type { AssetStore } from './asset-store';

import { drawLastPlaceSpotlight } from './ceremony-last-place';
import { drawPodiums, drawRankingPanel, PODIUM_BOTTOM, WINNER_LANDING_SECONDS } from './ceremony-podium';
import { TITLE_FONT } from './drawing-helpers';

const CONFETTI_START_SECONDS = 4;
const CONFETTI_COLORS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ffa94d'];

interface ConfettiPiece {
  x: number;
  offset: number;
  speed: number;
  spin: number;
  sway: number;
  color: string;
  size: number;
}

function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

const CONFETTI: ConfettiPiece[] = (() => {
  const random = createSeededRandom(7);
  return Array.from({ length: 160 }, () => ({
    x: random() * 1150,
    offset: random() * 1000,
    speed: 120 + random() * 160,
    spin: 2 + random() * 6,
    sway: random() * Math.PI * 2,
    color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)] ?? '#ffd43b',
    size: 7 + random() * 7,
  }));
})();

// 최종 순위 연출: 암전 → 타이틀 → 3·2·1위 착지(1위 때 화면 흔들림) → 왕관·꽃가루 → 전체 순위표 → 꼴찌 조명
export function drawCeremony(
  ctx: CanvasRenderingContext2D,
  assets: AssetStore,
  rankings: RankingEntry[],
  elapsed: number,
  playerId: string | null,
): void {
  const shake = computeShake(elapsed);
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawStageBackground(ctx, elapsed);
  drawCeremonyTitle(ctx, elapsed);
  drawPodiums(ctx, assets, rankings, elapsed, playerId);
  if (elapsed > CONFETTI_START_SECONDS) {
    drawConfetti(ctx, elapsed - CONFETTI_START_SECONDS);
  }
  drawLastPlaceSpotlight(ctx, assets, rankings, elapsed);
  ctx.restore();
  drawRankingPanel(ctx, assets, rankings, elapsed, playerId);
}

function computeShake(elapsed: number): { x: number; y: number } {
  const sinceLanding = elapsed - WINNER_LANDING_SECONDS;
  if (sinceLanding < 0 || sinceLanding > 0.5) {
    return { x: 0, y: 0 };
  }
  const strength = 14 * (1 - sinceLanding / 0.5);
  return { x: Math.sin(elapsed * 90) * strength, y: Math.cos(elapsed * 70) * strength };
}

function drawStageBackground(ctx: CanvasRenderingContext2D, elapsed: number): void {
  const background = ctx.createRadialGradient(620, 420, 50, 620, 420, 900);
  background.addColorStop(0, '#2d2457');
  background.addColorStop(1, '#0b0916');
  ctx.fillStyle = background;
  ctx.fillRect(-30, -30, 1660, 960);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beams: Array<[number, number]> = [[200, 0.35], [1040, -0.35]];
  if (elapsed > CONFETTI_START_SECONDS) {
    beams.push([620, 0]);
  }
  beams.forEach(([originX, baseAngle], index) => {
    const angle = baseAngle + (index < 2 ? Math.sin(elapsed * 1.2 + index * 2) * 0.12 : 0);
    const targetX = originX + Math.sin(angle) * 900;
    const beam = ctx.createLinearGradient(originX, -20, targetX, 860);
    beam.addColorStop(0, index === 2 ? 'rgba(255, 236, 153, 0.5)' : 'rgba(180, 200, 255, 0.28)');
    beam.addColorStop(1, 'rgba(180, 200, 255, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(originX - 20, -20);
    ctx.lineTo(originX + 20, -20);
    ctx.lineTo(targetX + 170, 880);
    ctx.lineTo(targetX - 170, 880);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(620, PODIUM_BOTTOM, 520, 60, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCeremonyTitle(ctx: CanvasRenderingContext2D, elapsed: number): void {
  const pop = Math.min(1, elapsed / 0.45);
  const scale = pop < 1 ? 0.4 + pop * 0.75 : 1 + Math.sin(elapsed * 3) * 0.02;
  const gradient = ctx.createLinearGradient(0, -50, 0, 40);
  gradient.addColorStop(0, '#fff3b0');
  gradient.addColorStop(1, '#f59f00');
  ctx.save();
  ctx.translate(620, 110);
  ctx.scale(scale, scale);
  ctx.globalAlpha = pop;
  ctx.font = `96px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 196, 0, 0.7)';
  ctx.shadowBlur = 30;
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#3b2a00';
  ctx.strokeText('최종 결과', 0, 0);
  ctx.fillStyle = gradient;
  ctx.fillText('최종 결과', 0, 0);
  ctx.restore();
}

function drawConfetti(ctx: CanvasRenderingContext2D, elapsed: number): void {
  CONFETTI.forEach((piece) => {
    ctx.save();
    ctx.translate(piece.x + Math.sin(elapsed * 2 + piece.sway) * 24, ((piece.offset + elapsed * piece.speed) % 1000) - 60);
    ctx.rotate(elapsed * piece.spin);
    ctx.fillStyle = piece.color;
    ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
    ctx.restore();
  });
}
