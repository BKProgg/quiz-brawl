import type { GameConfig } from '../game/game-config';
import type { AnswerZone } from '../game/game-types';
import type { AssetStore } from './asset-store';
import type { Judgement } from './client-state';

import { BODY_FONT, fillRoundedRect, setFittedFont, shadeColor, TITLE_FONT } from './drawing-helpers';

const CHOICE_COLORS = ['#4dabf7', '#ffa94d', '#69db7c', '#da77f2'];
const OX_COLORS: Record<string, string> = { O: '#4dabf7', X: '#ff6b6b' };
const ZONE_POP_SECONDS = 0.35;

// 가장 센 흔들림(메테오 18)보다 커야 한다.
const SHAKE_BACKDROP_MARGIN = 20;

function getZoneColor(zone: AnswerZone): string {
  return OX_COLORS[zone.label] ?? CHOICE_COLORS[zone.choiceIndex % CHOICE_COLORS.length] ?? '#4dabf7';
}

export function drawArenaFloor(ctx: CanvasRenderingContext2D, assets: AssetStore, config: GameConfig): void {
  const image = assets.getArenaImage();
  if (image) {
    ctx.drawImage(image, 0, 0, config.arena.width, config.arena.height);
    return;
  }
  ctx.fillStyle = '#e6eaf0';
  ctx.fillRect(0, 0, config.arena.width, config.arena.height);
}

// 화면이 흔들리면 바닥이 밀려 가장자리에 빈 띠가 보이므로, 그 밑에 바닥을 조금 크게 한 번 더 깔아 둔다.
export function drawArenaShakeBackdrop(ctx: CanvasRenderingContext2D, assets: AssetStore, config: GameConfig): void {
  const image = assets.getArenaImage();
  // 이미지를 못 불러온 경우에는 단색 바닥이라 빈 띠가 보여도 괜찮다. 캔버스 출력이라 브라우저에서 확인했다.
  if (image) {
    const { width, height } = config.arena;
    ctx.drawImage(image, -SHAKE_BACKDROP_MARGIN, -SHAKE_BACKDROP_MARGIN, width + SHAKE_BACKDROP_MARGIN * 2, height + SHAKE_BACKDROP_MARGIN * 2);
  }
}

// 구역이 생길 때 살짝 튀어나오는 연출을 하고, 정답이 공개되면 정답 구역만 빛나게 한다.
export function drawAnswerZoneAreas(
  ctx: CanvasRenderingContext2D,
  zones: AnswerZone[],
  judgement: Judgement | null,
  sinceAppeared: number,
  time: number,
): void {
  const pop = Math.min(1, sinceAppeared / ZONE_POP_SECONDS);
  const scale = pop < 1 ? 0.6 + 0.4 * pop + Math.sin(pop * Math.PI) * 0.08 : 1;
  zones.forEach((zone) => {
    const color = getZoneColor(zone);
    const isCorrect = judgement !== null && zone.choiceIndex === judgement.answerIndex;
    ctx.save();
    ctx.translate(zone.x + zone.width / 2, zone.y + zone.height / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = judgement !== null && !isCorrect ? 0.35 : 1;
    ctx.fillStyle = `${color}38`;
    ctx.beginPath();
    ctx.roundRect(-zone.width / 2, -zone.height / 2, zone.width, zone.height, 22);
    ctx.fill();
    if (isCorrect) {
      ctx.shadowColor = '#ffd43b';
      ctx.shadowBlur = 30 + Math.sin(time * 10) * 10;
    }
    ctx.strokeStyle = isCorrect ? '#ffd43b' : color;
    ctx.lineWidth = isCorrect ? 8 : 5;
    ctx.setLineDash(judgement === null ? [18, 10] : []);
    ctx.lineDashOffset = -time * 40;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    if (zone.text === '') {
      ctx.fillStyle = `${color}55`;
      ctx.font = `${Math.round(zone.height * 0.7)}px ${TITLE_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zone.label, 0, 8);
    }
    ctx.restore();
  });
}

export function drawAnswerZoneLabels(ctx: CanvasRenderingContext2D, zones: AnswerZone[], judgement: Judgement | null): void {
  zones.forEach((zone) => {
    const color = getZoneColor(zone);
    ctx.save();
    ctx.globalAlpha = judgement !== null && zone.choiceIndex !== judgement.answerIndex ? 0.45 : 1;
    const fontSize = setFittedFont(ctx, zone.text, 26, zone.width - 90, BODY_FONT);
    const pillWidth = zone.text === '' ? 52 : ctx.measureText(zone.text).width + 76;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    fillRoundedRect(ctx, zone.x + 12, zone.y + 10, pillWidth, 52, 26);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(zone.x + 38, zone.y + 36, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `30px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone.label, zone.x + 38, zone.y + 39);
    ctx.font = `${fontSize}px ${BODY_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = shadeColor(color, -0.6);
    ctx.fillText(zone.text, zone.x + 70, zone.y + 38);
    ctx.restore();
  });
}
