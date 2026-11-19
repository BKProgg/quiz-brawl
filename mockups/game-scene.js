'use strict';

const ZONE_COLORS = ['#4dabf7', '#ffa94d', '#69db7c', '#da77f2'];
const MOCK_ZONES = [
  { x: 170, y: 200, width: 340, height: 200, text: '불변(final) 필드' },
  { x: 1090, y: 190, width: 340, height: 200, text: 'equals·hashCode 자동 생성' },
  { x: 330, y: 520, width: 360, height: 200, text: '다른 클래스를 상속(extends)' },
  { x: 950, y: 500, width: 360, height: 200, text: '간결한 DTO 표현' },
];
const CORRECT_ZONE_INDEX = 2;
const COUNTDOWN_SECONDS = 10;
const LOOP_SECONDS = 13;

const MOCK_PLAYERS = [
  { name: '김버그', color: 0, variant: 0, x: 300, y: 340, pose: 'walk', facing: 1 },
  { name: '이배포', color: 1, variant: 3, x: 1390, y: 340, pose: 'punch', facing: -1 },
  { name: '박리뷰', color: 2, variant: 1, x: 430, y: 670, pose: 'block', facing: 1, isSelf: true },
  { name: '최커밋', color: 3, variant: 2, x: 505, y: 660, pose: 'punch', facing: -1 },
  { name: '정머지', color: 4, variant: 4, x: 640, y: 620, pose: 'kick', facing: 1 },
  { name: '강핫픽스', color: 7, variant: 1, x: 755, y: 610, pose: 'stunned', facing: -1 },
  { name: '윤로그', color: 5, variant: 2, x: 890, y: 470, pose: 'airborne', facing: 1 },
  { name: '장캐시', color: 6, variant: 0, x: 770, y: 510, pose: 'punch', facing: 1 },
  { name: '임쿼리', color: 8, variant: 3, x: 1180, y: 345, pose: 'hold', facing: 1, itemKind: 5 },
  { name: '한테스트', color: 9, variant: 4, x: 1090, y: 650, pose: 'down', facing: 1 },
];

const FLOOR_ITEMS = [
  { kind: 1, x: 900, y: 720, rotation: 0.2 },
  { kind: 2, x: 210, y: 480, rotation: 0 },
  { kind: 3, x: 700, y: 300, rotation: -0.1 },
  { kind: 4, x: 820, y: 760, rotation: 0 },
  { kind: 5, x: 590, y: 440, rotation: 0.3 },
];

function drawGameScene(ctx, time) {
  const loopTime = time % LOOP_SECONDS;
  const isRevealed = loopTime >= COUNTDOWN_SECONDS;
  drawArenaFloor(ctx);
  MOCK_ZONES.forEach((zone, index) => drawAnswerZone(ctx, zone, index, time, isRevealed));
  FLOOR_ITEMS.forEach((item) => {
    drawItemShadow(ctx, item.x, item.y, 1);
    drawItem(ctx, item.kind, item.x, item.y, item.rotation, 1.1);
  });
  drawThrowTrail(ctx, 790, 470, 890, 410);
  [...MOCK_PLAYERS].sort((first, second) => first.y - second.y).forEach((player) => {
    drawCharacter(ctx, {
      x: player.x, y: player.y, color: CHARACTER_COLORS[player.color], variant: player.variant, pose: player.pose,
      facing: player.facing, time, nickname: player.name, isSelf: player.isSelf, itemKind: player.itemKind, scale: 1.15,
    });
  });
  drawShieldArc(ctx, 430, 670, 1);
  drawImpactBurst(ctx, 718, 565, 38, '퍽!', time);
  drawDustPuffs(ctx, 1090, 655, time);
  const mugX = 1330 - ((time * 260) % 100);
  drawSpeedLines(ctx, mugX, 305, -1);
  drawItem(ctx, 0, mugX, 305, time * 12, 1.1);
  MOCK_ZONES.forEach((zone, index) => drawAnswerZoneLabel(ctx, zone, index, isRevealed));
  if (isRevealed) {
    [[430, 560], [505, 550], [640, 515]].forEach(([textX, textY]) => drawFloatingText(ctx, textX, textY, '+100', '#2f9e44', loopTime));
  }
  drawQuestionBanner(ctx, loopTime, isRevealed);
  drawScorePanels(ctx);
  drawControlsHint(ctx);
}

function drawArenaFloor(ctx) {
  if (isSpriteReady()) {
    drawSpriteArena(ctx);
    return;
  }
  ctx.fillStyle = '#e6eaf0';
  ctx.fillRect(0, 0, 1600, 900);
  ctx.fillStyle = '#dde3eb';
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      if ((row + column) % 2 === 0) ctx.fillRect(column * 100, row * 100, 100, 100);
    }
  }
  ctx.strokeStyle = '#2f3646';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.roundRect(7, 7, 1586, 886, 24);
  ctx.stroke();
}

function drawAnswerZone(ctx, zone, index, time, isRevealed) {
  const color = ZONE_COLORS[index];
  const isCorrect = index === CORRECT_ZONE_INDEX;
  ctx.save();
  ctx.globalAlpha = isRevealed && !isCorrect ? 0.35 : 1;
  ctx.fillStyle = `${color}38`;
  ctx.beginPath();
  ctx.roundRect(zone.x, zone.y, zone.width, zone.height, 22);
  ctx.fill();
  if (isRevealed && isCorrect) {
    ctx.shadowColor = '#ffd43b';
    ctx.shadowBlur = 30 + Math.sin(time * 10) * 10;
  }
  ctx.strokeStyle = isRevealed && isCorrect ? '#ffd43b' : color;
  ctx.lineWidth = isRevealed && isCorrect ? 8 : 5;
  ctx.setLineDash(isRevealed ? [] : [18, 10]);
  ctx.lineDashOffset = -time * 40;
  ctx.stroke();
  ctx.restore();
}

function drawAnswerZoneLabel(ctx, zone, index, isRevealed) {
  const color = ZONE_COLORS[index];
  ctx.save();
  ctx.globalAlpha = isRevealed && index !== CORRECT_ZONE_INDEX ? 0.45 : 1;
  ctx.font = '26px Jua, sans-serif';
  const maxTextWidth = zone.width - 90;
  const fontSize = Math.min(26, Math.floor((26 * maxTextWidth) / ctx.measureText(zone.text).width));
  ctx.font = `${fontSize}px Jua, sans-serif`;
  const pillWidth = ctx.measureText(zone.text).width + 76;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.roundRect(zone.x + 12, zone.y - 26, pillWidth, 52, 26);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(zone.x + 38, zone.y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '30px "Black Han Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1), zone.x + 38, zone.y + 3);
  ctx.font = `${fontSize}px Jua, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = shadeColor(color, -0.6);
  ctx.fillText(zone.text, zone.x + 70, zone.y + 2);
  ctx.restore();
}

function drawQuestionBanner(ctx, loopTime, isRevealed) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(29, 35, 48, 0.94)';
  ctx.beginPath();
  ctx.roundRect(300, 22, 1000, 118, 22);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.roundRect(326, 44, 112, 40, 20);
  ctx.fill();
  ctx.fillStyle = '#1d2330';
  ctx.font = '24px "Black Han Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Q3 / 5', 382, 66);
  ctx.fillStyle = '#adb5bd';
  ctx.font = '18px Jua, sans-serif';
  ctx.fillText('4지선다', 382, 108);
  ctx.textAlign = 'left';
  ctx.font = '34px Jua, sans-serif';
  ctx.fillStyle = isRevealed ? '#8ce99a' : '#ffffff';
  const text = isRevealed ? '정답은 3번! 다른 클래스를 상속(extends)' : '다음 중 Java record의 특징이 아닌 것은?';
  ctx.fillText(text, 466, 82);
  drawCountdownRing(ctx, 1240, 81, isRevealed ? 0 : COUNTDOWN_SECONDS - loopTime);
}

function drawCountdownRing(ctx, x, y, remaining) {
  const isUrgent = remaining <= 3;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#3b4252';
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = isUrgent ? '#ff6b6b' : '#ffd43b';
  ctx.beginPath();
  ctx.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * remaining) / COUNTDOWN_SECONDS);
  ctx.stroke();
  ctx.fillStyle = isUrgent ? '#ff6b6b' : '#ffffff';
  ctx.font = `${isUrgent ? 50 : 44}px "Black Han Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.ceil(remaining)), x, y + 3);
}

function drawScorePanels(ctx) {
  ctx.fillStyle = 'rgba(29, 35, 48, 0.82)';
  ctx.beginPath();
  ctx.roundRect(28, 30, 250, 110, 16);
  ctx.fill();
  ctx.font = '19px Jua, sans-serif';
  ctx.textBaseline = 'middle';
  [['1', '이배포', 300, 1], ['2', '박리뷰', 250, 2], ['3', '최커밋', 200, 3]].forEach(([rank, name, score, colorIndex], index) => {
    const rowY = 56 + index * 30;
    ctx.fillStyle = ['#ffd43b', '#dee2e6', '#e8a87c'][index];
    ctx.textAlign = 'left';
    ctx.fillText(rank, 46, rowY);
    ctx.fillStyle = CHARACTER_COLORS[colorIndex];
    ctx.beginPath();
    ctx.arc(80, rowY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 98, rowY);
    ctx.textAlign = 'right';
    ctx.fillText(String(score), 258, rowY);
  });
  ctx.fillStyle = 'rgba(255, 212, 59, 0.95)';
  ctx.beginPath();
  ctx.roundRect(1322, 46, 250, 70, 16);
  ctx.fill();
  ctx.fillStyle = '#1d2330';
  ctx.textAlign = 'center';
  ctx.font = '18px Jua, sans-serif';
  ctx.fillText('내 점수', 1447, 66);
  ctx.font = '28px "Black Han Sans", sans-serif';
  ctx.fillText('250점 · 2위', 1447, 96);
}

function drawControlsHint(ctx) {
  ctx.fillStyle = 'rgba(29, 35, 48, 0.75)';
  ctx.beginPath();
  ctx.roundRect(470, 846, 660, 36, 18);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Jua, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('←↑↓→ 이동   Z 주먹·줍기·던지기   X 발차기   C 막기', 800, 865);
}
