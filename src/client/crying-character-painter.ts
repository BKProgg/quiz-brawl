import type { AssetStore } from './asset-store';

import { getCharacterColorHex } from '../game/character-palette';

const CHARACTER_IDLE_HEIGHT = 96;
const VISIBLE_BODY_RATIO = 0.76;
const EYE_HEIGHT_RATIO = 0.33;
const TEAR_COLOR = '#74c0fc';

// 꼴찌 전용: 무릎 꿇고 엉엉 우는 캐릭터.
// 기본 자세 그림에서 다리를 감춰 무릎 꿇은 모습을 만들고, 앞으로 숙인 채 흐느끼며 눈물을 분수처럼 쏟는다.
export function drawCryingCharacter(
  ctx: CanvasRenderingContext2D,
  assets: AssetStore,
  options: { x: number; y: number; colorIndex: number; scale: number; time: number },
): void {
  const frame = assets.getCharacterFrame('idle', getCharacterColorHex(options.colorIndex));
  if (!frame) {
    return;
  }
  const scale = (options.scale * CHARACTER_IDLE_HEIGHT) / assets.getIdleHeight();
  const visibleHeight = frame.height * VISIBLE_BODY_RATIO;
  const sob = Math.abs(Math.sin(options.time * 7)) * 4 * options.scale + Math.sin(options.time * 40) * 0.8;
  drawTearPuddles(ctx, options);
  ctx.save();
  ctx.fillStyle = 'rgba(20, 24, 33, 0.25)';
  ctx.beginPath();
  ctx.ellipse(options.x, options.y, frame.width * scale * 0.45, 9 * options.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(options.x, options.y + sob * 0.3);
  ctx.rotate(0.16 + Math.sin(options.time * 7) * 0.03);
  ctx.scale(scale * (1 + sob * 0.004), scale * (1 - sob * 0.006));
  ctx.drawImage(frame.image, 0, 0, frame.width, visibleHeight, -frame.width / 2, -visibleHeight, frame.width, visibleHeight);
  const eyeY = -visibleHeight + frame.height * EYE_HEIGHT_RATIO;
  [-1, 1].forEach((side) => drawTearStream(ctx, side * frame.width * 0.36, eyeY, side, options.time, frame.height));
  ctx.restore();
}

// 눈가에서 바깥쪽으로 뿜어져 나와 아래로 떨어지는 눈물 줄기와 물방울.
function drawTearStream(ctx: CanvasRenderingContext2D, startX: number, startY: number, side: number, time: number, size: number): void {
  const reach = size * 0.55;
  ctx.save();
  ctx.strokeStyle = TEAR_COLOR;
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.035;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(startX + side * reach * 0.9, startY - reach * 0.35, startX + side * reach * 1.2, startY + reach * 0.9);
  ctx.stroke();
  ctx.fillStyle = TEAR_COLOR;
  for (let index = 0; index < 4; index += 1) {
    const progress = (time * 1.8 + index / 4) % 1;
    const dropX = startX + side * reach * (0.4 + progress * 0.9);
    const dropY = startY - reach * 0.25 + progress * progress * reach * 1.6;
    ctx.globalAlpha = 1 - progress * 0.6;
    ctx.beginPath();
    ctx.arc(dropX, dropY, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 양옆 바닥에 점점 커지는 눈물 웅덩이.
function drawTearPuddles(ctx: CanvasRenderingContext2D, options: { x: number; y: number; scale: number; time: number }): void {
  const growth = Math.min(1, options.time / 10) * 0.6 + 0.4;
  ctx.save();
  ctx.fillStyle = 'rgba(116, 192, 252, 0.45)';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.ellipse(options.x + side * 62 * options.scale, options.y + 2, 30 * growth * options.scale, 8 * growth * options.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
