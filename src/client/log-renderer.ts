import type { GameConfig } from '../game/game-config';
import type { LogSnapshot } from '../game/protocol-types';

import { shadeColor } from './drawing-helpers';

const BARK_COLOR = '#8a5a2b';
const RING_COLOR = '#d9a86c';
const WARNING_COLOR = '#ffd43b';
const RING_COUNT = 5;

// 굴러오기 전 경고: 통나무가 나올 벽 쪽에 노란 화살표 띠가 깜빡인다.
export function drawLogWarnings(ctx: CanvasRenderingContext2D, logs: LogSnapshot[], config: GameConfig, time: number): void {
  const { left, right } = config.arena;
  const { halfLength } = config.log;
  logs.filter((log) => log.state === 'warning').forEach((log) => {
    const edgeX = log.direction === 1 ? left : right;
    const blink = 0.45 + 0.55 * Math.abs(Math.sin(time * 9));
    ctx.save();
    ctx.globalAlpha = blink;
    const band = ctx.createLinearGradient(edgeX, 0, edgeX + log.direction * 260, 0);
    band.addColorStop(0, 'rgba(255, 212, 59, 0.55)');
    band.addColorStop(1, 'rgba(255, 212, 59, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(Math.min(edgeX, edgeX + log.direction * 260), log.y - halfLength, 260, halfLength * 2);
    ctx.fillStyle = WARNING_COLOR;
    ctx.strokeStyle = '#1f2430';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    for (let index = 0; index < 3; index += 1) {
      const tipX = edgeX + log.direction * (50 + index * 44 + ((time * 160) % 44));
      ctx.beginPath();
      ctx.moveTo(tipX, log.y);
      ctx.lineTo(tipX - log.direction * 26, log.y - 22);
      ctx.lineTo(tipX - log.direction * 14, log.y);
      ctx.lineTo(tipX - log.direction * 26, log.y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  });
}

// 굴러가는 통나무: 세로로 긴 원통. 나이테 줄이 진행 방향으로 흘러 굴러가는 것처럼 보이고, 뒤로 먼지가 인다.
export function drawRollingLogs(ctx: CanvasRenderingContext2D, logs: LogSnapshot[], config: GameConfig, time: number): void {
  const { radius, halfLength } = config.log;
  logs.filter((log) => log.state === 'rolling').forEach((log) => {
    drawDustTrail(ctx, log, radius, halfLength, time);
    ctx.save();
    ctx.fillStyle = 'rgba(20, 24, 33, 0.28)';
    ctx.beginPath();
    ctx.ellipse(log.x + 6, log.y + halfLength + 10, radius * 1.1, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(log.x, log.y);
    const body = ctx.createLinearGradient(-radius, 0, radius, 0);
    body.addColorStop(0, shadeColor(BARK_COLOR, -0.35));
    body.addColorStop(0.4, shadeColor(BARK_COLOR, 0.15));
    body.addColorStop(1, shadeColor(BARK_COLOR, -0.45));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-radius, -halfLength, radius * 2, halfLength * 2, radius * 0.35);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-radius, -halfLength, radius * 2, halfLength * 2, radius * 0.35);
    ctx.clip();
    ctx.strokeStyle = 'rgba(60, 35, 10, 0.55)';
    ctx.lineWidth = 3;
    const scroll = ((time * config.log.speed * log.direction) % (radius * 2 / RING_COUNT * 2) + radius * 4) % (radius * 2 / RING_COUNT * 2);
    for (let index = -RING_COUNT; index <= RING_COUNT; index += 1) {
      const stripeX = -radius + index * ((radius * 2) / RING_COUNT) + scroll;
      ctx.beginPath();
      ctx.moveTo(stripeX, -halfLength);
      ctx.lineTo(stripeX, halfLength);
      ctx.stroke();
    }
    ctx.restore();
    [-1, 1].forEach((end) => drawLogEnd(ctx, end * halfLength, radius));
    ctx.strokeStyle = '#3b2412';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-radius, -halfLength, radius * 2, halfLength * 2, radius * 0.35);
    ctx.stroke();
    ctx.restore();
  });
}

function drawLogEnd(ctx: CanvasRenderingContext2D, endY: number, radius: number): void {
  ctx.fillStyle = RING_COLOR;
  ctx.beginPath();
  ctx.ellipse(0, endY, radius * 0.92, radius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeColor(RING_COLOR, -0.45);
  ctx.lineWidth = 2;
  [0.7, 0.45, 0.2].forEach((ratio) => {
    ctx.beginPath();
    ctx.ellipse(0, endY, radius * 0.92 * ratio, radius * 0.42 * ratio, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawDustTrail(ctx: CanvasRenderingContext2D, log: LogSnapshot, radius: number, halfLength: number, time: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(190, 196, 206, 0.45)';
  for (let index = 0; index < 5; index += 1) {
    const phase = (time * 3 + index * 0.37) % 1;
    const puffX = log.x - log.direction * (radius + 10 + phase * 90);
    const puffY = log.y + halfLength - 6 - phase * 30 + Math.sin(index * 2.1) * 8;
    ctx.globalAlpha = (1 - phase) * 0.6;
    ctx.beginPath();
    ctx.arc(puffX, puffY, 8 + phase * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
