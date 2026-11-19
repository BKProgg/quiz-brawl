'use strict';

const CHARACTER_COLORS = ['#ff5a5f', '#3d8bfd', '#2ec27e', '#ffc93c', '#9b5de5', '#ff8fc7', '#1fc7d4', '#ff8a3d', '#a47551', '#e9edf2'];

const BODY_VARIANTS = [
  { widthScale: 1.0, limbScale: 1.0 },
  { widthScale: 1.3, limbScale: 0.8 },
  { widthScale: 0.82, limbScale: 1.35 },
  { widthScale: 1.15, limbScale: 1.2 },
  { widthScale: 0.9, limbScale: 0.85 },
];

const OUTLINE_COLOR = '#1f2430';

function shadeColor(hex, ratio) {
  const value = parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const adjusted = channels.map((channel) => {
    const next = ratio < 0 ? channel * (1 + ratio) : channel + (255 - channel) * ratio;
    return Math.max(0, Math.min(255, Math.round(next)));
  });
  return `#${adjusted.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function createBodyMetrics(variantIndex) {
  const variant = BODY_VARIANTS[variantIndex % BODY_VARIANTS.length];
  const width = 46 * variant.widthScale;
  const height = 52;
  const legLength = 16 * variant.limbScale;
  const armLength = 19 * variant.limbScale;
  const hipY = -legLength;
  const top = hipY - height;
  return { width, height, legLength, armLength, hipY, top, shoulderY: hipY - height * 0.42, totalHeight: legLength + height };
}

function drawCharacter(ctx, options) {
  if (isSpriteReady()) {
    drawSpriteCharacter(ctx, options);
    return;
  }
  const body = createBodyMetrics(options.variant ?? 0);
  const pose = options.pose ?? 'idle';
  const facing = options.facing ?? 1;
  const time = options.time ?? 0;
  const scale = options.scale ?? 1;
  const limbColor = shadeColor(options.color, -0.38);
  ctx.save();
  ctx.translate(options.x, options.y);
  ctx.scale(scale, scale);
  drawGroundShadow(ctx, body, pose);
  applyPoseTransform(ctx, body, pose, facing, time);
  const limbs = computeLimbs(body, pose, facing, time);
  limbs.legs.forEach((leg) => drawLeg(ctx, leg, limbColor, facing));
  drawBody(ctx, body, options.color, options.isSelf);
  drawFace(ctx, body, pose, facing);
  limbs.arms.forEach((arm) => drawArm(ctx, arm, limbColor));
  if (pose === 'hold') drawItem(ctx, options.itemKind ?? 0, 0, body.top - 24, 0, 0.9);
  if (options.crown) drawCrown(ctx, 0, body.top + 6, body.width * 0.95);
  if (pose === 'stunned') drawDizzyStars(ctx, body, time);
  ctx.restore();
  if (options.nickname) drawNameTag(ctx, options, body, pose, scale);
}

function applyPoseTransform(ctx, body, pose, facing, time) {
  const centerY = (body.hipY + body.top) / 2;
  if (pose === 'airborne') {
    ctx.translate(0, -48 + centerY);
    ctx.rotate(time * 9 * facing);
    ctx.translate(0, -centerY);
  } else if (pose === 'grabbed') {
    ctx.translate(0, -28);
    ctx.rotate(Math.sin(time * 10) * 0.15);
  } else if (pose === 'down') {
    ctx.translate((body.totalHeight / 2) * facing, -body.width / 2 + 2);
    ctx.rotate((-Math.PI / 2) * facing);
  } else if (pose === 'stunned') {
    ctx.rotate(Math.sin(time * 9) * 0.1 - 0.14 * facing);
  } else if (pose === 'punch') {
    ctx.rotate(0.08 * facing);
  } else if (pose === 'kick') {
    ctx.rotate(-0.14 * facing);
  } else if (pose === 'cheer') {
    ctx.translate(0, -Math.abs(Math.sin(time * 6)) * 12);
  } else if (pose === 'walk') {
    ctx.translate(0, -Math.abs(Math.sin(time * 12)) * 3);
  }
}

function computeLimbs(body, pose, facing, time) {
  const swing = pose === 'walk' ? Math.sin(time * 12) : 0;
  const shoulderX = body.width / 2 - 5;
  const hipX = body.width * 0.22;
  const legs = [-1, 1].map((side) => {
    const from = { x: side * hipX, y: body.hipY };
    const angle = swing * 0.55 * side;
    const to = { x: from.x + Math.sin(angle) * body.legLength + side * 2, y: from.y + Math.cos(angle) * body.legLength };
    return { side, from, to };
  });
  const arms = [-1, 1].map((side) => {
    const from = { x: side * shoulderX, y: body.shoulderY };
    const to = { x: from.x + side * 7 - Math.sin(swing * 0.7) * side * body.armLength * 0.6, y: from.y + body.armLength * 0.95 };
    return { side, from, to };
  });
  applyPoseLimbs(body, pose, facing, time, { legs, arms });
  return { legs, arms };
}

function applyPoseLimbs(body, pose, facing, time, limbs) {
  const isFront = (limb) => limb.side === facing;
  const extend = (limb, deltaX, deltaY) => {
    limb.to = { x: limb.from.x + deltaX, y: limb.from.y + deltaY };
  };
  if (pose === 'punch') {
    limbs.arms.forEach((arm) => {
      if (isFront(arm)) extend(arm, facing * body.armLength * 1.9, -4);
      else extend(arm, -facing * 4, body.armLength * 0.6);
    });
  } else if (pose === 'kick') {
    limbs.legs.filter(isFront).forEach((leg) => extend(leg, facing * body.legLength * 2.1, -body.legLength * 0.55));
    limbs.arms.forEach((arm) => extend(arm, -facing * body.armLength * 0.6, -body.armLength * 0.5));
  } else if (pose === 'block') {
    limbs.arms.forEach((arm) => {
      arm.to = { x: facing * (body.width / 2 + 7), y: body.shoulderY - (isFront(arm) ? 14 : 4) };
    });
  } else if (pose === 'hold') {
    limbs.arms.forEach((arm) => {
      arm.to = { x: arm.side * 9, y: body.top - 12 };
    });
  } else if (pose === 'cheer') {
    limbs.arms.forEach((arm) => extend(arm, arm.side * body.armLength * 0.75, -body.armLength * 1.15));
  } else if (pose === 'grabbed' || pose === 'airborne') {
    limbs.arms.forEach((arm) => extend(arm, arm.side * body.armLength * 0.9, -body.armLength * 0.7 + Math.sin(time * 16 + arm.side) * 5));
    limbs.legs.forEach((leg) => extend(leg, leg.side * 6 + Math.sin(time * 14 + leg.side) * 4, body.legLength + 2));
  }
}

function drawLimbLine(ctx, from, to, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawLeg(ctx, leg, color, facing) {
  drawLimbLine(ctx, leg.from, leg.to, color, 6);
  ctx.fillStyle = shadeColor(color, -0.35);
  ctx.beginPath();
  ctx.ellipse(leg.to.x + facing * 3, leg.to.y, 7.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawArm(ctx, arm, color) {
  drawLimbLine(ctx, arm.from, arm.to, color, 6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(arm.to.x, arm.to.y, 5.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBody(ctx, body, color, isSelf) {
  const left = -body.width / 2;
  const path = new Path2D();
  path.roundRect(left, body.top, body.width, body.height, [body.width / 2, body.width / 2, 14, 14]);
  if (isSelf) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.stroke(path);
  }
  const gradient = ctx.createLinearGradient(left, body.top, body.width / 2, body.hipY);
  gradient.addColorStop(0, shadeColor(color, 0.3));
  gradient.addColorStop(0.55, color);
  gradient.addColorStop(1, shadeColor(color, -0.12));
  ctx.fillStyle = gradient;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = shadeColor(color, -0.3);
  ctx.fillRect(left, body.hipY - 13, body.width, 13);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(left + body.width * 0.28, body.top + 14, body.width * 0.12, 7, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = shadeColor(color, -0.5);
  ctx.lineWidth = 3;
  ctx.stroke(path);
}

function drawGroundShadow(ctx, body, pose) {
  const radiusX = pose === 'down' ? body.totalHeight * 0.6 : body.width * 0.6;
  const shrink = pose === 'airborne' ? 0.55 : pose === 'grabbed' ? 0.8 : 1;
  ctx.fillStyle = 'rgba(20, 24, 33, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX * shrink, 7 * shrink, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawNameTag(ctx, options, body, pose, scale) {
  const extraHeight = { airborne: 62, grabbed: 42, hold: 44 }[pose] ?? 14;
  const height = pose === 'down' ? body.width + 10 : body.totalHeight + extraHeight + (options.crown ? 28 : 0);
  drawNameTagAt(ctx, options, options.y - height * scale - 12);
}

function drawNameTagAt(ctx, options, tagY) {
  const fontSize = Math.round(15 * Math.max(1, (options.scale ?? 1) * 0.75));
  ctx.save();
  ctx.font = `${fontSize}px Jua, sans-serif`;
  const textWidth = ctx.measureText(options.nickname).width;
  const tagHeight = fontSize + 8;
  ctx.fillStyle = options.isSelf ? '#ffd43b' : 'rgba(22, 26, 36, 0.72)';
  ctx.beginPath();
  ctx.roundRect(options.x - textWidth / 2 - 9, tagY - tagHeight / 2, textWidth + 18, tagHeight, tagHeight / 2);
  ctx.fill();
  ctx.fillStyle = options.isSelf ? OUTLINE_COLOR : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(options.nickname, options.x, tagY + 1);
  if (options.isSelf) {
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.moveTo(options.x - 8, tagY - tagHeight / 2 - 12);
    ctx.lineTo(options.x + 8, tagY - tagHeight / 2 - 12);
    ctx.lineTo(options.x, tagY - tagHeight / 2 - 3);
    ctx.fill();
  }
  ctx.restore();
}
