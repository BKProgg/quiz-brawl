import type { RankingEntry } from '../game/game-types';
import type { AssetStore } from './asset-store';

import { findLastPlaceEntries } from './ceremony-last-place';
import { drawCharacter } from './character-renderer';
import { BODY_FONT, fillRoundedRect, shadeColor, TITLE_FONT } from './drawing-helpers';

export const PODIUM_BOTTOM = 880;
export const WINNER_LANDING_SECONDS = 3.4;
const WINNER_CELEBRATION_SECONDS = 4;
const PANEL_SLIDE_SECONDS = 5;
const FALL_SECONDS = 0.45;
const RANK_COLORS = ['#ffd43b', '#dee2e6', '#e8a87c'];

// 순위표 순서(index)로 시상대 자리를 정한다. 동점이면 숫자는 실제 순위를 보여 준다.
const PODIUMS = [
  { order: 0, centerX: 620, top: 540, color: '#f7c948', landAt: WINNER_LANDING_SECONDS },
  { order: 1, centerX: 400, top: 620, color: '#cfd8e3', landAt: 2.2 },
  { order: 2, centerX: 840, top: 680, color: '#e0a370', landAt: 1.2 },
];

export function drawPodiums(
  ctx: CanvasRenderingContext2D,
  assets: AssetStore,
  rankings: RankingEntry[],
  elapsed: number,
  playerId: string | null,
): void {
  PODIUMS.forEach((podium) => {
    const entry = rankings[podium.order];
    const left = podium.centerX - 100;
    const gradient = ctx.createLinearGradient(left, 0, left + 200, 0);
    gradient.addColorStop(0, shadeColor(podium.color, 0.25));
    gradient.addColorStop(1, shadeColor(podium.color, -0.2));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(left, podium.top, 200, PODIUM_BOTTOM - podium.top, [12, 12, 0, 0]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `84px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(entry?.rank ?? podium.order + 1), podium.centerX, podium.top + 62);
    if (entry) {
      drawPodiumPlayer(ctx, assets, entry, podium, elapsed, entry.playerId === playerId);
    }
  });
}

function drawPodiumPlayer(
  ctx: CanvasRenderingContext2D,
  assets: AssetStore,
  entry: RankingEntry,
  podium: (typeof PODIUMS)[number],
  elapsed: number,
  isSelf: boolean,
): void {
  const fallStart = podium.landAt - FALL_SECONDS;
  if (elapsed < fallStart) {
    return;
  }
  const fallProgress = Math.min(1, (elapsed - fallStart) / FALL_SECONDS);
  const isWinner = podium.order === 0 && elapsed > WINNER_CELEBRATION_SECONDS;
  let pose: 'airborne' | 'cheer' | 'idle' = isWinner ? 'cheer' : 'idle';
  if (fallProgress < 1) {
    pose = 'airborne';
  }
  drawCharacter(ctx, assets, {
    x: podium.centerX,
    y: podium.top - 700 * (1 - fallProgress) ** 2,
    colorIndex: entry.colorIndex,
    pose,
    facingSign: 1,
    time: elapsed,
    scale: 1.6,
    lift: 0,
    isSelf,
    hasCrown: isWinner,
  });
  if (fallProgress < 1) {
    return;
  }
  const countProgress = Math.min(1, (elapsed - podium.landAt) / 0.9);
  ctx.fillStyle = '#1d2330';
  ctx.font = `26px ${BODY_FONT}`;
  ctx.fillText(entry.nickname, podium.centerX, podium.top + 112);
  ctx.font = `30px ${TITLE_FONT}`;
  ctx.fillText(`${Math.round(entry.score * countProgress)}점`, podium.centerX, podium.top + 148);
}

export function drawRankingPanel(
  ctx: CanvasRenderingContext2D,
  assets: AssetStore,
  rankings: RankingEntry[],
  elapsed: number,
  playerId: string | null,
): void {
  const slide = Math.min(1, Math.max(0, (elapsed - PANEL_SLIDE_SECONDS) / 0.6));
  if (slide <= 0) {
    return;
  }
  ctx.save();
  ctx.translate((1 - slide) ** 3 * 480, 0);
  ctx.fillStyle = 'rgba(15, 18, 30, 0.78)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1150, 150, 420, 700, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `32px ${TITLE_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('전체 순위', 1180, 196);
  const lastPlaceIds = new Set(findLastPlaceEntries(rankings).map((entry) => entry.playerId));
  rankings.slice(0, 10).forEach((entry, index) => {
    drawRankingRow(ctx, assets, entry, 250 + index * 60, elapsed, { isSelf: entry.playerId === playerId, isLast: lastPlaceIds.has(entry.playerId) });
  });
  ctx.restore();
}

function drawRankingRow(
  ctx: CanvasRenderingContext2D,
  assets: AssetStore,
  entry: RankingEntry,
  rowY: number,
  elapsed: number,
  flags: { isSelf: boolean; isLast: boolean },
): void {
  if (flags.isSelf) {
    ctx.fillStyle = 'rgba(255, 212, 59, 0.22)';
    fillRoundedRect(ctx, 1166, rowY - 26, 388, 52, 12);
  }
  ctx.fillStyle = RANK_COLORS[entry.rank - 1] ?? '#adb5bd';
  ctx.font = `28px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(entry.rank), 1196, rowY + 2);
  drawCharacter(ctx, assets, {
    x: 1250,
    y: rowY + 22,
    colorIndex: entry.colorIndex,
    pose: 'idle',
    facingSign: 1,
    time: elapsed,
    scale: 0.5,
    lift: 0,
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = `24px ${BODY_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(entry.nickname, 1290, rowY + 2);
  ctx.textAlign = 'right';
  ctx.font = `24px ${TITLE_FONT}`;
  ctx.fillText(`${entry.score}점`, 1540, rowY + 2);
  if (flags.isLast) {
    ctx.fillStyle = '#ff6b6b';
    fillRoundedRect(ctx, 1384, rowY - 13, 54, 26, 13);
    ctx.fillStyle = '#ffffff';
    ctx.font = `16px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('꼴찌', 1411, rowY + 1);
  }
}
