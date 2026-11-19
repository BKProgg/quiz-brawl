export const OUTLINE_COLOR = '#1f2430';
export const TITLE_FONT = '"Black Han Sans", sans-serif';
export const BODY_FONT = 'Jua, sans-serif';

export function shadeColor(hex: string, ratio: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const adjusted = channels.map((channel) => {
    const next = ratio < 0 ? channel * (1 + ratio) : channel + (255 - channel) * ratio;
    return Math.max(0, Math.min(255, Math.round(next)));
  });
  return `#${adjusted.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function fillRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

// 최대 너비를 넘으면 글자 크기를 줄여서 한 줄에 맞춘다.
export function setFittedFont(ctx: CanvasRenderingContext2D, text: string, baseSize: number, maxWidth: number, family: string): number {
  ctx.font = `${baseSize}px ${family}`;
  const width = ctx.measureText(text).width;
  const fontSize = width > maxWidth ? Math.floor((baseSize * maxWidth) / width) : baseSize;
  ctx.font = `${fontSize}px ${family}`;
  return fontSize;
}

export function drawOutlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, outlineWidth: number): void {
  ctx.lineWidth = outlineWidth;
  ctx.strokeStyle = '#ffffff';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, outerRadius: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : outerRadius * 0.43;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawCrown(ctx: CanvasRenderingContext2D, x: number, baseY: number, width: number): void {
  const half = width / 2;
  const height = width * 0.62;
  const gradient = ctx.createLinearGradient(0, baseY - height, 0, baseY);
  gradient.addColorStop(0, '#fff3b0');
  gradient.addColorStop(0.5, '#ffc41a');
  gradient.addColorStop(1, '#d48806');
  ctx.save();
  ctx.translate(x, baseY);
  ctx.fillStyle = gradient;
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  [[-half, 0], [-half, -height * 0.75], [-half / 2, -height * 0.35], [0, -height], [half / 2, -height * 0.35], [half, -height * 0.75], [half, 0]]
    .forEach(([pointX, pointY]) => ctx.lineTo(pointX as number, pointY as number));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  [[-half, -height * 0.75, '#ff4d6d'], [0, -height, '#4dabf7'], [half, -height * 0.75, '#ff4d6d']].forEach(([gemX, gemY, color]) => {
    ctx.fillStyle = color as string;
    ctx.beginPath();
    ctx.arc(gemX as number, gemY as number, 3.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
