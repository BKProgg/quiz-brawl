import type { ItemSnapshot } from '../game/protocol-types';
import type { AssetStore } from './asset-store';

const ITEM_DRAW_SIZE = 50;
const FLYING_SPIN_SPEED = 14;

export function drawItemSprite(
  ctx: CanvasRenderingContext2D,
  assets: AssetStore,
  kind: number,
  x: number,
  y: number,
  rotation: number,
  scale: number,
): void {
  const frame = assets.getItemFrame(kind);
  if (!frame) {
    return;
  }
  const fitScale = (scale * ITEM_DRAW_SIZE) / Math.max(frame.width, frame.height);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(fitScale, fitScale);
  ctx.drawImage(frame.image, -frame.width / 2, -frame.height / 2);
  ctx.restore();
}

export function drawFloorItems(ctx: CanvasRenderingContext2D, assets: AssetStore, items: ItemSnapshot[]): void {
  items.filter((item) => item.state === 'floor').forEach((item) => {
    ctx.fillStyle = 'rgba(20, 24, 33, 0.18)';
    ctx.beginPath();
    ctx.ellipse(item.x, item.y + 4, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    drawItemSprite(ctx, assets, item.kind, item.x, item.y - 14, 0, 1);
  });
}

// 날아가는 아이템은 회전시키고, 지나온 방향으로 잔상을 남긴다.
export class FlyingItemRenderer {
  private readonly previousPositions = new Map<string, { x: number; y: number }>();

  draw(ctx: CanvasRenderingContext2D, assets: AssetStore, items: ItemSnapshot[], time: number): void {
    const flyingItems = items.filter((item) => item.state === 'flying');
    flyingItems.forEach((item) => {
      const previous = this.previousPositions.get(item.id) ?? item;
      const length = Math.hypot(item.x - previous.x, item.y - previous.y);
      if (length > 0) {
        drawSpeedLines(ctx, item, { x: (item.x - previous.x) / length, y: (item.y - previous.y) / length });
      }
      drawItemSprite(ctx, assets, item.kind, item.x, item.y - 30, time * FLYING_SPIN_SPEED, 1);
    });
    this.previousPositions.clear();
    flyingItems.forEach((item) => this.previousPositions.set(item.id, { x: item.x, y: item.y }));
  }
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, item: ItemSnapshot, direction: { x: number; y: number }): void {
  const normal = { x: -direction.y, y: direction.x };
  ctx.save();
  ctx.strokeStyle = 'rgba(55, 65, 85, 0.45)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  [-12, -4, 4, 12].forEach((offset, index) => {
    const startX = item.x + normal.x * offset - direction.x * 24;
    const startY = item.y - 30 + normal.y * offset - direction.y * 24;
    const length = 40 + (index % 2) * 26;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX - direction.x * length, startY - direction.y * length);
    ctx.stroke();
  });
  ctx.restore();
}
