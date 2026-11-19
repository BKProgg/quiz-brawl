import type { GameConfig } from '../game/game-config';
import type { PlayerSnapshot } from '../game/protocol-types';
import type { ClientGameState } from './client-state';

import { getCharacterColorHex } from '../game/character-palette';
import { getPhaseRemaining, isSpectating } from './client-state';
import { drawBigCountdown, drawUrgentWarning, URGENT_SECONDS } from './countdown-renderer';
import { BODY_FONT, fillRoundedRect, setFittedFont, TITLE_FONT } from './drawing-helpers';

const BANNER = { x: 300, y: 22, width: 1000, height: 118 };
const BANNER_DROP_SECONDS = 0.6;
const RANK_COLORS = ['#ffd43b', '#dee2e6', '#e8a87c'];
const SPECTATOR_NOTICE = '게임이 진행 중이라 다음 판부터 참여합니다. 지금은 구경 중!';
const ADMIN_NOTICE = '관리자 관전 화면';
const CONTROLS_HINT = '←↑↓→ 이동   Z 주먹·줍기·들기·던지기   X 발차기   C 막기';

interface BannerContent {
  tag: string;
  subTag: string;
  text: string;
  textColor: string;
  remaining: number;
  total: number;
}

export function drawHud(ctx: CanvasRenderingContext2D, state: ClientGameState, players: PlayerSnapshot[], now: number, config: GameConfig): void {
  const remaining = getPhaseRemaining(state, now);
  if (state.phase === 'intro') {
    drawBigCountdown(ctx, remaining, '#ffd43b');
  }
  if (state.phase === 'question' && state.zones.length > 0 && remaining <= URGENT_SECONDS) {
    drawUrgentWarning(ctx, remaining);
  }
  const banner = buildBannerContent(state, now, config);
  if (banner) {
    ctx.save();
    ctx.translate(0, state.phase === 'question' ? computeBannerDropOffset((now - state.questionReceivedAt) / 1000) : 0);
    drawBanner(ctx, banner);
    ctx.restore();
  }
  if (state.phase !== 'lobby') {
    drawScorePanels(ctx, state, players);
  }
  drawFooter(ctx, getFooterText(state));
}

function getFooterText(state: ClientGameState): string {
  if (state.isAdminView) {
    return ADMIN_NOTICE;
  }
  return isSpectating(state) ? SPECTATOR_NOTICE : CONTROLS_HINT;
}

function buildBannerContent(state: ClientGameState, now: number, config: GameConfig): BannerContent | null {
  const remaining = getPhaseRemaining(state, now);
  const question = state.question;
  if (state.phase === 'question' && question) {
    const subTag = question.type === 'OX' ? 'OX' : '4지선다';
    const tag = `Q${question.index + 1} / ${question.total}`;
    return { tag, subTag, text: question.text, textColor: '#ffffff', remaining, total: question.countdownSeconds };
  }
  if (state.phase === 'between' && question && state.judgement) {
    const answer = question.choices[state.judgement.answerIndex] ?? '';
    const label = question.type === 'OX' ? answer : `${state.judgement.answerIndex + 1}번 ${answer}`;
    const isLast = question.index + 1 >= question.total;
    const total = isLast ? config.timeline.finalRevealDelaySeconds : config.timeline.betweenBrawlSeconds;
    const subTag = isLast ? '곧 결과 발표' : '다음 문제까지';
    return { tag: `Q${question.index + 1} / ${question.total}`, subTag, text: `정답은 ${label}!`, textColor: '#8ce99a', remaining, total };
  }
  return null;
}

// 문제 배너는 화면 위에서 뚝 떨어져 살짝 튕기며 자리 잡는다.
function computeBannerDropOffset(elapsedSeconds: number): number {
  const progress = Math.min(1, Math.max(0, elapsedSeconds / BANNER_DROP_SECONDS));
  const bounce = progress < 0.7 ? (progress / 0.7) ** 2 : 1 - Math.sin(((progress - 0.7) / 0.3) * Math.PI) * 0.08;
  return -(BANNER.y + BANNER.height + 40) * (1 - bounce);
}

function drawBanner(ctx: CanvasRenderingContext2D, banner: BannerContent): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(29, 35, 48, 0.94)';
  fillRoundedRect(ctx, BANNER.x, BANNER.y, BANNER.width, BANNER.height, 22);
  ctx.restore();
  ctx.fillStyle = '#ffd43b';
  fillRoundedRect(ctx, 326, 44, 112, 40, 20);
  ctx.fillStyle = '#1d2330';
  setFittedFont(ctx, banner.tag, 24, 100, TITLE_FONT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(banner.tag, 382, 66);
  ctx.fillStyle = '#adb5bd';
  ctx.font = `18px ${BODY_FONT}`;
  ctx.fillText(banner.subTag, 382, 108);
  ctx.textAlign = 'left';
  ctx.fillStyle = banner.textColor;
  setFittedFont(ctx, banner.text, 34, 700, BODY_FONT);
  ctx.fillText(banner.text, 466, 82);
  drawCountdownRing(ctx, 1240, 81, banner.remaining, banner.total);
}

function drawCountdownRing(ctx: CanvasRenderingContext2D, x: number, y: number, remaining: number, total: number): void {
  const isUrgent = remaining <= 3;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#3b4252';
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = isUrgent ? '#ff6b6b' : '#ffd43b';
  ctx.beginPath();
  ctx.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * remaining) / Math.max(total, 0.001));
  ctx.stroke();
  ctx.fillStyle = isUrgent ? '#ff6b6b' : '#ffffff';
  ctx.font = `${isUrgent ? 50 : 44}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.ceil(remaining)), x, y + 3);
}

function drawScorePanels(ctx: CanvasRenderingContext2D, state: ClientGameState, players: PlayerSnapshot[]): void {
  const ranked = [...players].sort((first, second) => second.score - first.score);
  ctx.fillStyle = 'rgba(29, 35, 48, 0.82)';
  fillRoundedRect(ctx, 28, 30, 250, 110, 16);
  ctx.font = `19px ${BODY_FONT}`;
  ctx.textBaseline = 'middle';
  ranked.slice(0, 3).forEach((player, index) => {
    const rowY = 56 + index * 30;
    const rosterPlayer = state.roster.get(player.id);
    const rank = ranked.findIndex((other) => other.score === player.score) + 1;
    ctx.textAlign = 'left';
    ctx.fillStyle = RANK_COLORS[rank - 1] ?? '#ffffff';
    ctx.fillText(String(rank), 46, rowY);
    ctx.fillStyle = getCharacterColorHex(rosterPlayer?.colorIndex ?? 0);
    ctx.beginPath();
    ctx.arc(80, rowY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rosterPlayer?.nickname ?? '', 98, rowY);
    ctx.textAlign = 'right';
    ctx.fillText(String(player.score), 258, rowY);
  });
  const myIndex = ranked.findIndex((player) => player.id === state.playerId);
  const me = ranked[myIndex];
  if (!me) {
    return;
  }
  const myRank = ranked.findIndex((player) => player.score === me.score) + 1;
  ctx.fillStyle = 'rgba(255, 212, 59, 0.95)';
  fillRoundedRect(ctx, 1322, 46, 250, 70, 16);
  ctx.fillStyle = '#1d2330';
  ctx.textAlign = 'center';
  ctx.font = `18px ${BODY_FONT}`;
  ctx.fillText('내 점수', 1447, 66);
  ctx.font = `28px ${TITLE_FONT}`;
  ctx.fillText(`${me.score}점 · ${myRank}위`, 1447, 96);
}

function drawFooter(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.font = `18px ${BODY_FONT}`;
  const width = ctx.measureText(text).width + 60;
  ctx.fillStyle = 'rgba(29, 35, 48, 0.75)';
  fillRoundedRect(ctx, 800 - width / 2, 846, width, 36, 18);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 800, 865);
}
