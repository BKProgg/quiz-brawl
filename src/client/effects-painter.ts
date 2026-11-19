import { drawOutlinedText, TITLE_FONT } from './drawing-helpers';

export interface EffectFrame {
  x: number;
  y: number;
  progress: number;
  strength: number;
}

const SPARK_COUNT = 10;

// 맞는 순간: 가운데가 하얗게 번쩍이고, 불꽃 선이 사방으로 튄다.
export function drawSparkBurst(ctx: CanvasRenderingContext2D, effect: EffectFrame): void {
  const radius = 26 * effect.strength;
  const fade = 1 - effect.progress;
  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.globalAlpha = fade;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * (1 + effect.progress));
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  glow.addColorStop(0.4, 'rgba(255, 230, 120, 0.7)');
  glow.addColorStop(1, 'rgba(255, 170, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * (1 + effect.progress), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff3bf';
  ctx.lineCap = 'round';
  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const angle = (Math.PI * 2 * index) / SPARK_COUNT + effect.strength;
    const inner = radius * (0.5 + effect.progress * 1.2);
    const outer = inner + radius * (0.9 - effect.progress * 0.6);
    ctx.lineWidth = 4 * effect.strength * fade + 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

// 바닥에 퍼지는 충격파 고리.
export function drawShockwave(ctx: CanvasRenderingContext2D, effect: EffectFrame): void {
  const radius = 20 + effect.progress * 70 * effect.strength;
  ctx.save();
  ctx.globalAlpha = 0.7 * (1 - effect.progress);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6 * (1 - effect.progress) + 1;
  ctx.beginPath();
  ctx.ellipse(effect.x, effect.y, radius, radius * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// 바닥에 떨어질 때 양옆으로 퍼지는 흙먼지.
export function drawDustCloud(ctx: CanvasRenderingContext2D, effect: EffectFrame): void {
  ctx.save();
  ctx.globalAlpha = 0.65 * (1 - effect.progress);
  ctx.fillStyle = '#c3c9d2';
  [-1, 1].forEach((side) => {
    for (let index = 0; index < 4; index += 1) {
      const spread = (24 + index * 16) * (0.4 + effect.progress) * effect.strength;
      const size = (11 - index * 2) * (1 + effect.progress * 0.6) * effect.strength;
      ctx.beginPath();
      ctx.arc(effect.x + side * spread, effect.y - 4 - index * 4 - effect.progress * 10, size, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

export function drawScorePopup(ctx: CanvasRenderingContext2D, effect: EffectFrame, text: string): void {
  ctx.save();
  ctx.globalAlpha = 1 - Math.max(0, effect.progress - 0.5) * 2;
  ctx.font = `34px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawOutlinedText(ctx, text, effect.x, effect.y - effect.progress * 50, '#2f9e44', 6);
  ctx.restore();
}

const DIZZY_STAR_COUNT = 3;
const DIZZY_ORBIT = { radiusX: 34, radiusY: 11, height: 92, speed: 5 };

// 쓰러져 헤롱헤롱한 상태: 머리 위로 노란 별이 빙글빙글 돈다.
export function drawDizzyStars(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.save();
  ctx.fillStyle = '#ffd43b';
  ctx.strokeStyle = '#1f2430';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (let index = 0; index < DIZZY_STAR_COUNT; index += 1) {
    const angle = time * DIZZY_ORBIT.speed + (Math.PI * 2 * index) / DIZZY_STAR_COUNT;
    drawStar(ctx, x + Math.cos(angle) * DIZZY_ORBIT.radiusX, y - DIZZY_ORBIT.height + Math.sin(angle) * DIZZY_ORBIT.radiusY, 9, angle);
  }
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number): void {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const pointRadius = point % 2 === 0 ? radius : radius * 0.45;
    const angle = rotation + (Math.PI * point) / 5;
    ctx.lineTo(x + Math.cos(angle) * pointRadius, y + Math.sin(angle) * pointRadius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
