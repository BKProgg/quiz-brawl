'use strict';

function drawImpactBurst(ctx, x, y, radius, text, time) {
  const pulse = 1 + Math.sin(time * 18) * 0.07;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.beginPath();
  for (let index = 0; index < 24; index += 1) {
    const pointRadius = index % 2 === 0 ? radius : radius * 0.6;
    const angle = (Math.PI / 12) * index;
    ctx.lineTo(Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffe066';
  ctx.strokeStyle = '#f08c00';
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  ctx.font = `${Math.round(radius * 0.62)}px "Black Han Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, 0, 2);
  ctx.fillStyle = '#e03131';
  ctx.fillText(text, 0, 2);
  ctx.restore();
}

function drawSpeedLines(ctx, x, y, directionX) {
  ctx.strokeStyle = 'rgba(55, 65, 85, 0.45)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  [-12, -4, 4, 12].forEach((offsetY, index) => {
    ctx.beginPath();
    ctx.moveTo(x - directionX * 24, y + offsetY);
    ctx.lineTo(x - directionX * (64 + (index % 2) * 26), y + offsetY);
    ctx.stroke();
  });
}

function drawShieldArc(ctx, x, y, facing) {
  const centerX = x + facing * 14;
  const centerY = y - 44;
  const startAngle = facing > 0 ? -1 : Math.PI - 1;
  ctx.save();
  ctx.shadowColor = 'rgba(77, 171, 247, 0.9)';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = 'rgba(77, 171, 247, 0.9)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 40, startAngle, startAngle + 2);
  ctx.stroke();
  ctx.restore();
}

function drawDustPuffs(ctx, x, y, time) {
  const spread = (time * 30) % 24;
  ctx.fillStyle = 'rgba(160, 168, 180, 0.55)';
  [-1, 1].forEach((side) => {
    for (let index = 0; index < 2; index += 1) {
      ctx.beginPath();
      ctx.arc(x + side * (30 + spread + index * 14), y - 4 - index * 5, 7 - index * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawThrowTrail(ctx, fromX, fromY, toX, toY) {
  ctx.save();
  ctx.strokeStyle = 'rgba(55, 65, 85, 0.35)';
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.quadraticCurveTo((fromX + toX) / 2, Math.min(fromY, toY) - 90, toX, toY);
  ctx.stroke();
  ctx.restore();
}

function drawFloatingText(ctx, x, y, text, color, time) {
  const rise = (time * 40) % 40;
  ctx.save();
  ctx.globalAlpha = 1 - rise / 50;
  ctx.font = '30px "Black Han Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, x, y - rise);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y - rise);
  ctx.restore();
}

function createSeededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
