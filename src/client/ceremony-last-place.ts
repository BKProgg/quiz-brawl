import type { RankingEntry } from '../game/game-types';
import type { AssetStore } from './asset-store';

import { drawCryingCharacter } from './crying-character-painter';
import { BODY_FONT, fillRoundedRect, TITLE_FONT } from './drawing-helpers';

export const LAST_PLACE_REVEAL_SECONDS = 6.5;
const STAGE = { x: 160, y: 800 };
const PER_ROW = 4;
const COLUMN_SPACING = 80;
const ROW_HEIGHT = 75;
const LABEL_NAME_LIMIT = 3;

// 꼴찌 목록. 모두 같은 점수(전원 1등)거나 혼자면 꼴찌가 없다.
export function findLastPlaceEntries(rankings: RankingEntry[]): RankingEntry[] {
  const last = rankings.at(-1);
  if (!last || last.rank === 1) {
    return [];
  }
  return rankings.filter((entry) => entry.rank === last.rank);
}

// 1등 축하가 끝나면 조명이 왼쪽 아래 꼴찌에게 옮겨 간다. 무릎 꿇고 엉엉 우는 모습에 먹구름과 비를 내린다.
export function drawLastPlaceSpotlight(
  ctx: CanvasRenderingContext2D,
  assets: AssetStore,
  rankings: RankingEntry[],
  elapsed: number,
): void {
  const entries = findLastPlaceEntries(rankings);
  const sinceReveal = elapsed - LAST_PLACE_REVEAL_SECONDS;
  if (entries.length === 0 || sinceReveal < 0) {
    return;
  }
  const appear = Math.min(1, sinceReveal / 0.5);
  drawSpotlight(ctx, appear);
  // 동점 꼴찌는 모두 함께 운다. 4명씩 한 줄로 서고, 뒷줄은 조금 작게 그려 앞줄에 가리지 않게 한다.
  const rowCount = Math.ceil(entries.length / PER_ROW);
  [...entries].reverse().forEach((entry, reversedIndex) => {
    const index = entries.length - 1 - reversedIndex;
    const row = Math.floor(index / PER_ROW);
    const rowSize = Math.min(PER_ROW, entries.length - row * PER_ROW);
    const column = index % PER_ROW;
    const depth = rowCount - 1 - row;
    const x = STAGE.x + (column - (rowSize - 1) / 2) * COLUMN_SPACING + depth * 20;
    const baseY = STAGE.y - depth * ROW_HEIGHT;
    const dropY = baseY - 400 * (1 - appear) ** 2;
    const scale = 1.3 - depth * 0.15;
    drawCryingCharacter(ctx, assets, { x, y: dropY, colorIndex: entry.colorIndex, scale, time: elapsed + index * 0.7 });
    drawRainCloud(ctx, x, dropY - 135 * scale, elapsed + index, appear);
  });
  drawLastPlaceLabel(ctx, entries, appear);
}

function drawSpotlight(ctx: CanvasRenderingContext2D, appear: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = appear;
  const beam = ctx.createLinearGradient(20, -20, STAGE.x, STAGE.y);
  beam.addColorStop(0, 'rgba(150, 190, 255, 0.45)');
  beam.addColorStop(1, 'rgba(150, 190, 255, 0.08)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(60, -20);
  ctx.lineTo(STAGE.x + 170, STAGE.y + 60);
  ctx.lineTo(STAGE.x - 170, STAGE.y + 60);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRainCloud(ctx: CanvasRenderingContext2D, x: number, y: number, elapsed: number, appear: number): void {
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.strokeStyle = 'rgba(160, 200, 255, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let index = 0; index < 7; index += 1) {
    const offsetY = ((elapsed * 260 + index * 37) % 90) + 18;
    const dropX = x - 36 + index * 12;
    ctx.beginPath();
    ctx.moveTo(dropX, y + offsetY);
    ctx.lineTo(dropX - 4, y + offsetY + 12);
    ctx.stroke();
  }
  ctx.fillStyle = '#5c6476';
  [[-30, 4, 20], [-8, -6, 26], [18, 2, 22], [36, 8, 16]].forEach(([offsetX, offsetY, radius]) => {
    ctx.beginPath();
    ctx.arc(x + (offsetX as number), y + (offsetY as number), radius as number, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawLastPlaceLabel(ctx: CanvasRenderingContext2D, entries: RankingEntry[], appear: number): void {
  const shownNames = entries.slice(0, LABEL_NAME_LIMIT).map((entry) => entry.nickname).join(' · ');
  const names = entries.length > LABEL_NAME_LIMIT ? `${shownNames} 외 ${entries.length - LABEL_NAME_LIMIT}명` : shownNames;
  const text = `${names} · ${entries[0]?.score ?? 0}점`;
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.font = `20px ${BODY_FONT}`;
  const width = Math.max(150, ctx.measureText(text).width + 40);
  ctx.fillStyle = 'rgba(15, 18, 30, 0.85)';
  fillRoundedRect(ctx, STAGE.x - width / 2, STAGE.y + 14, width, 66, 16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff6b6b';
  ctx.font = `30px ${TITLE_FONT}`;
  ctx.fillText(entries.length > 1 ? `공동 꼴찌 ${entries.length}명` : '꼴찌', STAGE.x, STAGE.y + 36);
  ctx.fillStyle = '#e9ecef';
  ctx.font = `18px ${BODY_FONT}`;
  ctx.fillText(text, STAGE.x, STAGE.y + 63);
  ctx.restore();
}
