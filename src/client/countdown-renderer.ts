import { TITLE_FONT } from './drawing-helpers';

export const URGENT_SECONDS = 5;
const ARENA = { width: 1600, height: 900 };

// 화면 가운데에 커다란 숫자를 센다. 숫자가 바뀔 때마다 크게 나타났다가 줄어든다.
export function drawBigCountdown(ctx: CanvasRenderingContext2D, remaining: number, color: string): void {
  const count = Math.max(1, Math.ceil(remaining));
  const fraction = remaining - Math.floor(remaining);
  const scale = 1 + fraction * 0.35;
  ctx.save();
  ctx.translate(ARENA.width / 2, ARENA.height / 2);
  ctx.scale(scale, scale);
  ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, fraction * 2 + 0.3);
  ctx.font = `300px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(29, 35, 48, 0.85)';
  ctx.strokeText(String(count), 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(String(count), 0, 0);
  ctx.restore();
}

// 정답 제출 마지막 5초: 화면 가장자리부터 점점 붉어지고 1초마다 번쩍이며, 가운데에 큰 숫자를 센다.
export function drawUrgentWarning(ctx: CanvasRenderingContext2D, remaining: number): void {
  const urgency = 1 - Math.max(0, remaining) / URGENT_SECONDS;
  const pulse = 1 - (remaining - Math.floor(remaining));
  const centerX = ARENA.width / 2;
  const centerY = ARENA.height / 2;
  ctx.save();
  const vignette = ctx.createRadialGradient(centerX, centerY, ARENA.height * 0.25, centerX, centerY, ARENA.width * 0.7);
  vignette.addColorStop(0, `rgba(255, 40, 40, ${0.08 * urgency})`);
  vignette.addColorStop(1, `rgba(255, 20, 20, ${0.25 + 0.5 * urgency})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.fillStyle = `rgba(255, 60, 60, ${0.18 * pulse * urgency})`;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.restore();
  drawBigCountdown(ctx, remaining, '#ff4d4d');
}
