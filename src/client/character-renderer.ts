import type { PlayerSnapshot } from '../game/protocol-types';
import type { AssetStore, CharacterPose } from './asset-store';

import { getCharacterColorHex } from '../game/character-palette';
import { BODY_FONT, drawCrown, fillRoundedRect, OUTLINE_COLOR } from './drawing-helpers';
import { drawItemSprite } from './item-renderer';

const CHARACTER_IDLE_HEIGHT = 96;
const CROWN_HEAD_RATIO = 0.84;
const WALK_FRAME_RATE = 7;
const STRUGGLE_RATE = 26;
const STRUGGLE_MIN_ANGLE = 0.15;
const STRUGGLE_EXTRA_ANGLE = 0.3;

export interface CharacterDrawOptions {
  x: number;
  y: number;
  colorIndex: number;
  pose: CharacterPose;
  facingSign: number;
  time: number;
  scale: number;
  lift: number;
  label?: string;
  isSelf?: boolean;
  alpha?: number;
  hasCrown?: boolean;
  heldItemKind?: number | null;
  // 맞은 직후 번쩍임 세기(0~1). 하얗게 빛나며 살짝 찌그러진다.
  flash?: number;
  // 들려서 버둥거리는 정도(0~1). 풀려날 때가 가까울수록 크게 버둥거린다.
  struggle?: number;
}

// 서버 상태를 스프라이트 동작으로 바꾼다. 걷기는 기본·걷기 두 장을 번갈아 보여 준다.
export function resolveCharacterPose(player: PlayerSnapshot, isMoving: boolean, time: number): CharacterPose {
  switch (player.state) {
    case 'punching':
    case 'tossing':
      return 'punch';
    case 'lifting':
      return 'hold';
    case 'kicking':
      return 'kick';
    case 'stunned':
      return 'stunned';
    case 'grabbed':
    case 'airborne':
      return 'airborne';
    case 'down':
      return 'down';
    default:
      break;
  }
  if (player.isBlocking) {
    return 'block';
  }
  if (player.heldItemId !== null) {
    return 'hold';
  }
  if (isMoving) {
    return Math.floor(time * WALK_FRAME_RATE) % 2 === 0 ? 'walk' : 'idle';
  }
  return 'idle';
}

function computeBob(pose: CharacterPose, time: number): number {
  if (pose === 'cheer') {
    return Math.abs(Math.sin(time * 6)) * 12;
  }
  return pose === 'walk' ? Math.abs(Math.sin(time * 14)) * 3 : 0;
}

export function drawCharacter(ctx: CanvasRenderingContext2D, assets: AssetStore, options: CharacterDrawOptions): void {
  const frame = assets.getCharacterFrame(options.pose, getCharacterColorHex(options.colorIndex));
  if (!frame) {
    return;
  }
  const scaleX = (options.scale * CHARACTER_IDLE_HEIGHT) / assets.getIdleHeight();
  const scaleY = scaleX;
  const bob = computeBob(options.pose, options.time) * options.scale;
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.fillStyle = 'rgba(20, 24, 33, 0.2)';
  ctx.beginPath();
  ctx.ellipse(options.x, options.y, frame.width * scaleX * 0.38 * (options.lift > 0 ? 0.6 : 1), 8 * options.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(options.x, options.y - options.lift - bob);
  // 캔버스 출력이라 단위 테스트 대신 브라우저에서 확인했다.
  if (options.struggle !== undefined) {
    ctx.rotate(Math.sin(options.time * STRUGGLE_RATE) * (STRUGGLE_MIN_ANGLE + STRUGGLE_EXTRA_ANGLE * options.struggle));
  } else if (options.pose === 'airborne') {
    ctx.rotate(Math.sin(options.time * 9) * 0.25 * options.facingSign);
  }
  const flash = options.flash ?? 0;
  ctx.scale(options.facingSign * scaleX * (1 + flash * 0.14), scaleY * (1 - flash * 0.08));
  if (options.isSelf) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 16;
  }
  ctx.drawImage(frame.image, -frame.width / 2, -frame.height, frame.width, frame.height);
  if (flash > 0) {
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, flash * 1.2);
    ctx.drawImage(frame.image, -frame.width / 2, -frame.height, frame.width, frame.height);
    ctx.drawImage(frame.image, -frame.width / 2, -frame.height, frame.width, frame.height);
  }
  ctx.restore();
  const topY = options.y - options.lift - bob - frame.height * scaleY;
  const hasHeldItem = options.heldItemKind !== undefined && options.heldItemKind !== null;
  if (hasHeldItem) {
    drawItemSprite(ctx, assets, options.heldItemKind as number, options.x, topY - 6 * options.scale, 0, options.scale);
  }
  if (options.hasCrown) {
    drawCrown(ctx, options.x, options.y - bob - frame.height * scaleY * CROWN_HEAD_RATIO, 46 * options.scale);
  }
  if (options.label) {
    drawNameTag(ctx, options.label, options.x, topY - (hasHeldItem ? 46 : 12) * options.scale, options.isSelf === true, options.scale);
  }
}

// 캐릭터 선택 화면의 미리보기 한 칸을 그린다.
export function drawCharacterPreview(canvas: HTMLCanvasElement, assets: AssetStore, colorIndex: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = (canvas.height * 0.82) / CHARACTER_IDLE_HEIGHT;
  drawCharacter(ctx, assets, { x: canvas.width / 2, y: canvas.height - 8, colorIndex, pose: 'idle', facingSign: 1, time: 0, scale, lift: 0 });
}

function drawNameTag(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, isSelf: boolean, scale: number): void {
  const fontSize = Math.round(15 * Math.max(1, scale * 0.75));
  const tagHeight = fontSize + 8;
  ctx.save();
  ctx.font = `${fontSize}px ${BODY_FONT}`;
  const textWidth = ctx.measureText(label).width;
  ctx.fillStyle = isSelf ? '#ffd43b' : 'rgba(22, 26, 36, 0.72)';
  fillRoundedRect(ctx, x - textWidth / 2 - 9, y - tagHeight / 2, textWidth + 18, tagHeight, tagHeight / 2);
  ctx.fillStyle = isSelf ? OUTLINE_COLOR : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 1);
  if (isSelf) {
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.moveTo(x - 8, y - tagHeight / 2 - 12);
    ctx.lineTo(x + 8, y - tagHeight / 2 - 12);
    ctx.lineTo(x, y - tagHeight / 2 - 3);
    ctx.fill();
  }
  ctx.restore();
}
