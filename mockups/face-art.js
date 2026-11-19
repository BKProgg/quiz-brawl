'use strict';

function drawFace(ctx, body, pose, facing) {
  const centerX = facing * body.width * 0.1;
  const eyeY = body.top + 21;
  const eyeRadius = Math.min(8, body.width * 0.19);
  const spacing = Math.min(9.5, body.width * 0.2);
  ctx.fillStyle = 'rgba(255, 110, 135, 0.45)';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.ellipse(centerX + side * body.width * 0.3, eyeY + 12, 4.2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  if (pose === 'stunned' || pose === 'down') {
    [-1, 1].forEach((side) => drawCrossEye(ctx, centerX + side * spacing, eyeY, eyeRadius * 0.7));
    drawWavyMouth(ctx, centerX, eyeY + 14);
    return;
  }
  if (pose === 'block') {
    [-1, 1].forEach((side) => drawSqueezedEye(ctx, centerX + side * spacing, eyeY, eyeRadius * 0.75, side));
  } else {
    const isShocked = pose === 'airborne' || pose === 'grabbed';
    [-1, 1].forEach((side) => drawEye(ctx, centerX + side * spacing, eyeY, eyeRadius, facing, isShocked));
  }
  if (pose === 'punch' || pose === 'kick') drawAngryBrows(ctx, centerX, eyeY, spacing, eyeRadius);
  drawMouth(ctx, centerX, eyeY + 14, pose);
}

function drawEye(ctx, x, y, radius, facing, isShocked) {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const pupilRadius = isShocked ? radius * 0.28 : radius * 0.52;
  const pupilX = x + facing * radius * 0.28;
  ctx.fillStyle = OUTLINE_COLOR;
  ctx.beginPath();
  ctx.arc(pupilX, y + 0.5, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pupilX - pupilRadius * 0.35, y - pupilRadius * 0.35, pupilRadius * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrossEye(ctx, x, y, size) {
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();
}

function drawSqueezedEye(ctx, x, y, size, side) {
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + side * size, y - size);
  ctx.lineTo(x - side * size * 0.6, y);
  ctx.lineTo(x + side * size, y + size);
  ctx.stroke();
}

function drawAngryBrows(ctx, centerX, eyeY, spacing, eyeRadius) {
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(centerX + side * (spacing + eyeRadius), eyeY - eyeRadius - 5);
    ctx.lineTo(centerX + side * (spacing - eyeRadius * 0.5), eyeY - eyeRadius);
    ctx.stroke();
  });
}

function drawMouth(ctx, x, y, pose) {
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.fillStyle = '#7a1f2b';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (pose === 'cheer') {
    ctx.arc(x, y - 2, 7, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (pose === 'punch' || pose === 'kick') {
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(x - 6, y - 3, 12, 6, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.stroke();
  } else if (pose === 'airborne' || pose === 'grabbed') {
    ctx.ellipse(x, y, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.arc(x, y - 4, 5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
}

function drawWavyMouth(ctx, x, y) {
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let step = 0; step <= 12; step += 1) {
    const pointX = x - 7 + step * (14 / 12);
    const pointY = y + Math.sin(step * 1.1) * 1.8;
    if (step === 0) ctx.moveTo(pointX, pointY);
    else ctx.lineTo(pointX, pointY);
  }
  ctx.stroke();
}

function drawStar(ctx, x, y, outerRadius, innerRadius, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI / points) * index - Math.PI / 2;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

function drawDizzyStars(ctx, body, time) {
  for (let index = 0; index < 3; index += 1) {
    const angle = time * 4 + (index * Math.PI * 2) / 3;
    drawStar(ctx, Math.cos(angle) * body.width * 0.5, body.top - 10 + Math.sin(angle) * 5, 6.5, 2.8, 5, '#ffd43b');
  }
}

function drawCrown(ctx, x, baseY, width) {
  const crownWidth = Math.max(width, 34);
  const crownHeight = crownWidth * 0.62;
  ctx.save();
  ctx.translate(x, baseY);
  const gradient = ctx.createLinearGradient(0, -crownHeight, 0, 0);
  gradient.addColorStop(0, '#fff3b0');
  gradient.addColorStop(0.5, '#ffc41a');
  gradient.addColorStop(1, '#d48806');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  const half = crownWidth / 2;
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.lineTo(-half, -crownHeight * 0.75);
  ctx.lineTo(-half / 2, -crownHeight * 0.35);
  ctx.lineTo(0, -crownHeight);
  ctx.lineTo(half / 2, -crownHeight * 0.35);
  ctx.lineTo(half, -crownHeight * 0.75);
  ctx.lineTo(half, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  [[-half, -crownHeight * 0.75, '#ff4d6d'], [0, -crownHeight, '#4dabf7'], [half, -crownHeight * 0.75, '#ff4d6d']].forEach(([gemX, gemY, color]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(gemX, gemY, 3.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
