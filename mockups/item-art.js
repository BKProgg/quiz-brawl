'use strict';

const ITEM_NAMES = ['머그컵', '키보드', '사무용 의자', '서류 뭉치', '화분', '고무 오리'];

function drawItem(ctx, kind, x, y, rotation, scale) {
  if (isSpriteReady()) {
    drawSpriteItem(ctx, kind, x, y, rotation, scale);
    return;
  }
  const painters = [drawMug, drawKeyboard, drawChair, drawPaperStack, drawPlant, drawRubberDuck];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation ?? 0);
  ctx.scale(scale ?? 1, scale ?? 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.5;
  painters[kind % painters.length](ctx);
  ctx.restore();
}

function drawItemShadow(ctx, x, y, scale) {
  ctx.fillStyle = 'rgba(20, 24, 33, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 18 * (scale ?? 1), 20 * (scale ?? 1), 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMug(ctx) {
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(12, 1, 7, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-12, -13, 24, 28, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7b4a2a';
  ctx.beginPath();
  ctx.ellipse(0, -10, 9, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d8bfd';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('</>', 0, 4);
}

function drawKeyboard(ctx) {
  ctx.fillStyle = '#3b4252';
  ctx.beginPath();
  ctx.roundRect(-25, -12, 50, 24, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d8dee9';
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      ctx.fillRect(-21.5 + column * 4.8, -9 + row * 5, 3.6, 3.6);
    }
  }
  ctx.fillRect(-10, 6.5, 20, 3.2);
}

function drawChair(ctx) {
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.lineTo(0, 17);
  ctx.moveTo(-14, 17);
  ctx.lineTo(14, 17);
  ctx.stroke();
  ctx.fillStyle = OUTLINE_COLOR;
  [-14, 0, 14].forEach((wheelX) => {
    ctx.beginPath();
    ctx.arc(wheelX, 19, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.lineWidth = 2.5;
  ctx.fillStyle = '#f76707';
  ctx.beginPath();
  ctx.roundRect(-16, -1, 32, 8, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-18, -24, 10, 25, 4);
  ctx.fill();
  ctx.stroke();
}

function drawPaperStack(ctx) {
  [[-4, 4, -0.12], [3, 1, 0.1], [0, -2, -0.03]].forEach(([offsetX, offsetY, angle]) => {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.rect(-14, -17, 28, 34);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
  ctx.strokeStyle = '#adb5bd';
  ctx.lineWidth = 2;
  for (let line = 0; line < 4; line += 1) {
    ctx.beginPath();
    ctx.moveTo(-9, -11 + line * 6);
    ctx.lineTo(7, -11 + line * 6);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e03131';
  ctx.beginPath();
  ctx.arc(6, 9, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e03131';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('급', 6, 9.5);
}

function drawPlant(ctx) {
  ctx.fillStyle = '#40c057';
  [[-0.6, -8], [0, -12], [0.6, -8]].forEach(([angle, length]) => {
    ctx.save();
    ctx.translate(0, 0);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, length, 6, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
  ctx.fillStyle = '#d9733f';
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(12, 2);
  ctx.lineTo(8, 19);
  ctx.lineTo(-8, 19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-13, 0, 26, 5);
  ctx.strokeRect(-13, 0, 26, 5);
}

function drawRubberDuck(ctx) {
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.ellipse(-2, 7, 16, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(6, -8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff922b';
  ctx.beginPath();
  ctx.ellipse(15.5, -6, 5.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = OUTLINE_COLOR;
  ctx.beginPath();
  ctx.arc(8, -10, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-4, 6, 7, 0.2, Math.PI - 0.4);
  ctx.stroke();
}
