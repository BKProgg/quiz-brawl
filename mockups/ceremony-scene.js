'use strict';

const CEREMONY_LOOP_SECONDS = 12;
const MOCK_RANKINGS = [
  { rank: 1, name: '이배포', color: 1, variant: 3, score: 450 },
  { rank: 2, name: '박리뷰', color: 2, variant: 1, score: 400, isSelf: true },
  { rank: 3, name: '최커밋', color: 3, variant: 2, score: 350 },
  { rank: 4, name: '김버그', color: 0, variant: 0, score: 300 },
  { rank: 4, name: '정머지', color: 4, variant: 4, score: 300 },
  { rank: 6, name: '강핫픽스', color: 7, variant: 1, score: 250 },
  { rank: 7, name: '장캐시', color: 6, variant: 0, score: 200 },
  { rank: 8, name: '윤로그', color: 5, variant: 2, score: 150 },
  { rank: 9, name: '임쿼리', color: 8, variant: 3, score: 100 },
  { rank: 10, name: '한테스트', color: 9, variant: 4, score: 50 },
];
const PODIUMS = [
  { place: 1, centerX: 620, top: 540, color: '#f7c948', landAt: 3.4 },
  { place: 2, centerX: 400, top: 620, color: '#cfd8e3', landAt: 2.2 },
  { place: 3, centerX: 840, top: 680, color: '#e0a370', landAt: 1.2 },
];
const PODIUM_BOTTOM = 880;
const CONFETTI_COLORS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ffa94d'];
const CONFETTI = (() => {
  const random = createSeededRandom(7);
  return Array.from({ length: 160 }, () => ({
    x: random() * 1150, offset: random() * 1000, speed: 120 + random() * 160, spin: 2 + random() * 6,
    sway: random() * Math.PI * 2, color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)], size: 7 + random() * 7,
  }));
})();

function drawCeremonyScene(ctx, time) {
  const loopTime = time % CEREMONY_LOOP_SECONDS;
  const shake = computeShake(loopTime);
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawStageBackground(ctx, loopTime);
  drawCeremonyTitle(ctx, loopTime);
  PODIUMS.forEach((podium) => drawPodium(ctx, podium, loopTime));
  if (loopTime > 4) drawConfetti(ctx, loopTime - 4);
  ctx.restore();
  drawRankingPanel(ctx, loopTime);
}

function computeShake(loopTime) {
  const sinceLanding = loopTime - PODIUMS[0].landAt;
  if (sinceLanding < 0 || sinceLanding > 0.5) return { x: 0, y: 0 };
  const strength = 14 * (1 - sinceLanding / 0.5);
  return { x: Math.sin(loopTime * 90) * strength, y: Math.cos(loopTime * 70) * strength };
}

function drawStageBackground(ctx, loopTime) {
  const background = ctx.createRadialGradient(620, 420, 50, 620, 420, 900);
  background.addColorStop(0, '#2d2457');
  background.addColorStop(1, '#0b0916');
  ctx.fillStyle = background;
  ctx.fillRect(-30, -30, 1660, 960);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beams = [[200, 0.35], [1040, -0.35]];
  if (loopTime > 4) beams.push([620, 0]);
  beams.forEach(([originX, baseAngle], index) => {
    const angle = baseAngle + (index < 2 ? Math.sin(loopTime * 1.2 + index * 2) * 0.12 : 0);
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

function drawCeremonyTitle(ctx, loopTime) {
  const pop = Math.min(1, loopTime / 0.45);
  const scale = pop < 1 ? 0.4 + pop * 0.75 : 1 + Math.sin(loopTime * 3) * 0.02;
  ctx.save();
  ctx.translate(620, 110);
  ctx.scale(scale, scale);
  ctx.globalAlpha = pop;
  const gradient = ctx.createLinearGradient(0, -50, 0, 40);
  gradient.addColorStop(0, '#fff3b0');
  gradient.addColorStop(1, '#f59f00');
  ctx.font = '96px "Black Han Sans", sans-serif';
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

function drawPodium(ctx, podium, loopTime) {
  const width = 200;
  const left = podium.centerX - width / 2;
  const gradient = ctx.createLinearGradient(left, 0, left + width, 0);
  gradient.addColorStop(0, shadeColor(podium.color, 0.25));
  gradient.addColorStop(1, shadeColor(podium.color, -0.2));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(left, podium.top, width, PODIUM_BOTTOM - podium.top, [12, 12, 0, 0]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '84px "Black Han Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(podium.place), podium.centerX, podium.top + 62);
  const player = MOCK_RANKINGS[podium.place - 1];
  const fallStart = podium.landAt - 0.45;
  if (loopTime < fallStart) return;
  const fallProgress = Math.min(1, (loopTime - fallStart) / 0.45);
  const dropOffset = -700 * (1 - fallProgress) * (1 - fallProgress);
  const isWinner = podium.place === 1 && loopTime > 4;
  drawCharacter(ctx, {
    x: podium.centerX, y: podium.top + dropOffset, color: CHARACTER_COLORS[player.color], variant: player.variant,
    pose: fallProgress < 1 ? 'airborne' : isWinner ? 'cheer' : 'idle', facing: 1, time: loopTime, scale: 1.8,
    crown: isWinner, isSelf: player.isSelf,
  });
  if (fallProgress < 1) return;
  const countProgress = Math.min(1, (loopTime - podium.landAt) / 0.9);
  ctx.fillStyle = '#1d2330';
  ctx.font = '26px Jua, sans-serif';
  ctx.fillText(player.name, podium.centerX, podium.top + 112);
  ctx.font = '30px "Black Han Sans", sans-serif';
  ctx.fillText(`${Math.round(player.score * countProgress)}점`, podium.centerX, podium.top + 148);
}

function drawConfetti(ctx, elapsed) {
  CONFETTI.forEach((piece) => {
    const y = ((piece.offset + elapsed * piece.speed) % 1000) - 60;
    const x = piece.x + Math.sin(elapsed * 2 + piece.sway) * 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(elapsed * piece.spin);
    ctx.fillStyle = piece.color;
    ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
    ctx.restore();
  });
}

function drawRankingPanel(ctx, loopTime) {
  const slide = Math.min(1, Math.max(0, (loopTime - 5) / 0.6));
  if (slide <= 0) return;
  const offsetX = (1 - (1 - (1 - slide) ** 3)) * 480;
  ctx.save();
  ctx.translate(offsetX, 0);
  ctx.fillStyle = 'rgba(15, 18, 30, 0.78)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1150, 150, 420, 700, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '32px "Black Han Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('전체 순위', 1180, 196);
  MOCK_RANKINGS.forEach((player, index) => drawRankingRow(ctx, player, 250 + index * 60, loopTime));
  ctx.restore();
}

function drawRankingRow(ctx, player, rowY, loopTime) {
  if (player.isSelf) {
    ctx.fillStyle = 'rgba(255, 212, 59, 0.22)';
    ctx.beginPath();
    ctx.roundRect(1166, rowY - 26, 388, 52, 12);
    ctx.fill();
  }
  ctx.fillStyle = ['#ffd43b', '#dee2e6', '#e8a87c'][player.rank - 1] ?? '#adb5bd';
  ctx.font = '28px "Black Han Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(player.rank), 1196, rowY + 2);
  drawCharacter(ctx, {
    x: 1250, y: rowY + 20, color: CHARACTER_COLORS[player.color], variant: player.variant, pose: 'idle',
    facing: 1, time: loopTime, scale: 0.55,
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px Jua, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(player.name, 1290, rowY + 2);
  ctx.textAlign = 'right';
  ctx.font = '24px "Black Han Sans", sans-serif';
  ctx.fillText(`${player.score}점`, 1540, rowY + 2);
}
