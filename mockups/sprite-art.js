'use strict';

// AI로 만든 스프라이트를 불러와 플레이어 색을 입혀 그린다. 꺼져 있거나 못 불러오면 코드 그림으로 그린다.
const ASSET_BASE_URL = '../public/assets/';
const SPRITE_IDLE_HEIGHT = 84;
const SPRITE_ITEM_SIZE = 46;
const CROWN_HEAD_RATIO = 0.84;
const spriteState = { manifest: null, images: new Map(), tintedFrames: new Map(), style: 'cute', isEnabled: true };

async function loadSpriteAssets() {
  const manifest = await (await fetch(`${ASSET_BASE_URL}manifest.json`)).json();
  const characterFiles = Object.values(manifest.characters).flatMap((style) => Object.values(style.frames));
  const entries = [...characterFiles, ...manifest.items, ...Object.values(manifest.arena)];
  await Promise.all(entries.map((entry) => loadSpriteImage(entry.file)));
  spriteState.manifest = manifest;
}

function loadSpriteImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      spriteState.images.set(file, image);
      resolve();
    };
    image.onerror = () => reject(new Error(`이미지 로드 실패: ${file}`));
    image.src = ASSET_BASE_URL + file;
  });
}

function isSpriteReady() {
  return spriteState.isEnabled && spriteState.manifest !== null;
}

function getTintedFrame(file, color) {
  const key = `${file}|${color}`;
  if (!spriteState.tintedFrames.has(key)) spriteState.tintedFrames.set(key, createTintedCanvas(spriteState.images.get(file), color));
  return spriteState.tintedFrames.get(key);
}

// 흰색·회색(채도 낮고 밝은) 픽셀만 플레이어 색으로 바꾼다. 외곽선, 눈동자, 볼터치, 별은 그대로 둔다.
function createTintedCanvas(image, color) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const tint = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  for (let index = 0; index < pixels.data.length; index += 4) {
    const channels = [pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]];
    const brightest = Math.max(...channels);
    if (brightest < 90 || brightest - Math.min(...channels) > 40) continue;
    tint.forEach((value, offset) => {
      pixels.data[index + offset] = Math.round((value * brightest) / 255);
    });
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function drawSpriteCharacter(ctx, options) {
  const styleAssets = spriteState.manifest.characters[spriteState.style];
  const time = options.time ?? 0;
  const facing = options.facing ?? 1;
  const pose = resolveSpritePose(options.pose ?? 'idle', time);
  const frame = styleAssets.frames[pose];
  const variant = BODY_VARIANTS[(options.variant ?? 0) % BODY_VARIANTS.length];
  const scale = ((options.scale ?? 1) * SPRITE_IDLE_HEIGHT) / styleAssets.frames.idle.height;
  const scaleX = scale * variant.widthScale ** 0.8;
  const scaleY = scale * variant.limbScale ** 0.35;
  const lift = ({ airborne: 48, grabbed: 28 }[options.pose] ?? 0) * (options.scale ?? 1);
  const bob = computeSpriteBob(options.pose, time) * (options.scale ?? 1);
  ctx.save();
  ctx.translate(options.x, options.y);
  ctx.fillStyle = 'rgba(20, 24, 33, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 0, frame.width * scaleX * 0.38 * (lift > 0 ? 0.6 : 1), 7 * (options.scale ?? 1), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -lift - bob);
  if (options.pose === 'airborne' || options.pose === 'grabbed') ctx.rotate(Math.sin(time * 9) * 0.25);
  ctx.scale(facing * scaleX, scaleY);
  if (options.isSelf) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 16;
  }
  ctx.drawImage(getTintedFrame(frame.file, options.color), -frame.width / 2, -frame.height, frame.width, frame.height);
  ctx.restore();
  const topY = options.y - lift - bob - frame.height * scaleY;
  if (options.pose === 'hold') drawSpriteItem(ctx, options.itemKind ?? 0, options.x, topY - 4, 0, options.scale ?? 1);
  if (options.crown) drawCrown(ctx, options.x, options.y - bob - frame.height * scaleY * CROWN_HEAD_RATIO, 46 * (options.scale ?? 1));
  if (options.nickname) drawNameTagAt(ctx, options, topY - (options.pose === 'hold' ? 44 : 10) * (options.scale ?? 1));
}

function resolveSpritePose(pose, time) {
  if (pose === 'grabbed') return 'airborne';
  if (pose === 'walk') return Math.floor(time * 7) % 2 === 0 ? 'walk' : 'idle';
  return pose;
}

function computeSpriteBob(pose, time) {
  if (pose === 'cheer') return Math.abs(Math.sin(time * 6)) * 12;
  if (pose === 'walk') return Math.abs(Math.sin(time * 14)) * 3;
  return 0;
}

function drawSpriteItem(ctx, kind, x, y, rotation, scale) {
  const item = spriteState.manifest.items[kind % spriteState.manifest.items.length];
  const fitScale = ((scale ?? 1) * SPRITE_ITEM_SIZE) / Math.max(item.width, item.height);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation ?? 0);
  ctx.scale(fitScale, fitScale);
  ctx.drawImage(spriteState.images.get(item.file), -item.width / 2, -item.height / 2);
  ctx.restore();
}

function drawSpriteArena(ctx) {
  ctx.drawImage(spriteState.images.get(spriteState.manifest.arena.office.file), 0, 0, 1600, 900);
}
