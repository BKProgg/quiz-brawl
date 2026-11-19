import type { GameConfig } from '../game/game-config';
import type { MeteorSnapshot } from '../game/protocol-types';

const WARNING_RGB = '255, 122, 26';
const ROCK_COLOR = '#5c4033';
const CRATER_COLOR = '#2b1d14';
// 경고 시간의 이 비율이 지나면 하늘에서 유성이 보이기 시작한다.
const FALL_START_PROGRESS = 0.25;
const ROCK_START_OFFSET = { x: 460, y: -620 };
// 땅에 가까울수록 빨라지는 정도. 2에 가까우면 끝에 너무 빨라져 유성이 잘 안 보인다.
const FALL_ACCELERATION = 1.4;
const ROCK_START_RADIUS = 40;
const ROCK_END_RADIUS = 120;
const FLAME_COUNT = 5;

function clipToArena(ctx: CanvasRenderingContext2D, config: GameConfig): void {
  const { left, right, top, bottom } = config.arena;
  ctx.beginPath();
  ctx.rect(left, top, right - left, bottom - top);
  ctx.clip();
}

// 바닥 경고: 범위 전체가 주황색으로 깜빡이고, 안쪽 원이 차오르다 테두리에 닿는 순간 떨어진다. 캐릭터 아래에 그린다.
export function drawMeteorWarnings(ctx: CanvasRenderingContext2D, meteors: MeteorSnapshot[], config: GameConfig, time: number): void {
  const { radius } = config.meteor;
  meteors.filter((meteor) => meteor.state === 'warning').forEach((meteor) => {
    const blink = 0.14 + 0.1 * Math.abs(Math.sin(time * 8));
    ctx.save();
    clipToArena(ctx, config);
    ctx.fillStyle = `rgba(${WARNING_RGB}, ${blink})`;
    ctx.beginPath();
    ctx.arc(meteor.x, meteor.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${WARNING_RGB}, 0.28)`;
    ctx.beginPath();
    ctx.arc(meteor.x, meteor.y, radius * meteor.progress, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${WARNING_RGB}, 0.95)`;
    ctx.lineWidth = 6;
    ctx.setLineDash([26, 16]);
    ctx.lineDashOffset = -time * 80;
    ctx.beginPath();
    ctx.arc(meteor.x, meteor.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

// 떨어지는 유성과 충돌 화염. 캐릭터 위에 그린다.
export function drawMeteors(ctx: CanvasRenderingContext2D, meteors: MeteorSnapshot[], config: GameConfig, time: number): void {
  meteors.forEach((meteor) => {
    if (meteor.state === 'impact') {
      drawImpact(ctx, meteor, config);
    } else if (meteor.progress >= FALL_START_PROGRESS) {
      drawFallingRock(ctx, meteor, time);
    }
  });
}

// 처음엔 느리고 땅에 가까울수록 빨라지게 떨어진다.
function drawFallingRock(ctx: CanvasRenderingContext2D, meteor: MeteorSnapshot, time: number): void {
  const fallRatio = Math.min(1, (meteor.progress - FALL_START_PROGRESS) / (1 - FALL_START_PROGRESS)) ** FALL_ACCELERATION;
  const x = meteor.x + ROCK_START_OFFSET.x * (1 - fallRatio);
  const y = meteor.y + ROCK_START_OFFSET.y * (1 - fallRatio);
  const radius = ROCK_START_RADIUS + (ROCK_END_RADIUS - ROCK_START_RADIUS) * fallRatio;
  ctx.save();
  ctx.translate(x, y);
  drawFlames(ctx, radius, time);
  const body = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
  body.addColorStop(0, '#a9775a');
  body.addColorStop(1, ROCK_COLOR);
  ctx.fillStyle = body;
  ctx.strokeStyle = CRATER_COLOR;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = CRATER_COLOR;
  [[0.3, 0.2, 0.2], [-0.35, 0.3, 0.14], [0.05, -0.4, 0.16]].forEach(([ratioX, ratioY, ratioRadius]) => {
    ctx.beginPath();
    ctx.arc(radius * (ratioX as number), radius * (ratioY as number), radius * (ratioRadius as number), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// 유성 꼬리: 날아온 쪽(오른쪽 위)으로 불길이 뻗는다.
function drawFlames(ctx: CanvasRenderingContext2D, radius: number, time: number): void {
  const directionX = ROCK_START_OFFSET.x / Math.hypot(ROCK_START_OFFSET.x, ROCK_START_OFFSET.y);
  const directionY = ROCK_START_OFFSET.y / Math.hypot(ROCK_START_OFFSET.x, ROCK_START_OFFSET.y);
  for (let index = FLAME_COUNT; index > 0; index -= 1) {
    const distance = radius * (index * 0.55 + Math.sin(time * 30 + index) * 0.08);
    const flameRadius = radius * (1 - index * 0.13);
    const flame = ctx.createRadialGradient(0, 0, 0, 0, 0, flameRadius);
    flame.addColorStop(0, 'rgba(255, 244, 180, 0.9)');
    flame.addColorStop(0.5, 'rgba(255, 150, 40, 0.65)');
    flame.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.save();
    ctx.translate(directionX * distance, directionY * distance);
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(0, 0, flameRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawImpact(ctx: CanvasRenderingContext2D, meteor: MeteorSnapshot, config: GameConfig): void {
  const { radius } = config.meteor;
  const fade = 1 - meteor.progress;
  const blastRadius = radius * (0.35 + 0.65 * Math.sqrt(meteor.progress));
  ctx.save();
  clipToArena(ctx, config);
  ctx.globalAlpha = fade;
  const blast = ctx.createRadialGradient(meteor.x, meteor.y, 0, meteor.x, meteor.y, blastRadius);
  blast.addColorStop(0, 'rgba(255, 255, 255, 1)');
  blast.addColorStop(0.35, 'rgba(255, 214, 90, 0.9)');
  blast.addColorStop(0.75, 'rgba(255, 110, 30, 0.55)');
  blast.addColorStop(1, 'rgba(255, 70, 20, 0)');
  ctx.fillStyle = blast;
  ctx.beginPath();
  ctx.arc(meteor.x, meteor.y, blastRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 12 * fade + 2;
  ctx.beginPath();
  ctx.arc(meteor.x, meteor.y, blastRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
