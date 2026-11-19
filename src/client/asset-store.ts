export type CharacterPose = 'idle' | 'walk' | 'punch' | 'kick' | 'block' | 'hold' | 'stunned' | 'airborne' | 'down' | 'cheer';

interface AssetEntry {
  file: string;
  width: number;
  height: number;
}

interface AssetManifest {
  characters: Record<string, { frames: Record<CharacterPose, AssetEntry> }>;
  items: AssetEntry[];
  arena: Record<string, AssetEntry>;
}

export interface SpriteFrame extends AssetEntry {
  image: CanvasImageSource;
}

const ASSET_BASE_URL = '/assets/';
export const CHARACTER_STYLE = 'visor';
const TINT_MINIMUM_BRIGHTNESS = 90;
const TINT_MAXIMUM_SATURATION_RANGE = 40;

// AI로 만든 스프라이트(public/assets)를 불러오고, 플레이어 색을 입힌 결과를 캐시한다.
export class AssetStore {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly tintedFrames = new Map<string, HTMLCanvasElement>();
  private manifest: AssetManifest | null = null;

  async load(): Promise<void> {
    const response = await fetch(`${ASSET_BASE_URL}manifest.json`);
    const manifest = (await response.json()) as AssetManifest;
    const styleFrames = Object.values(manifest.characters[CHARACTER_STYLE]?.frames ?? {});
    const entries = [...styleFrames, ...manifest.items, ...Object.values(manifest.arena)];
    await Promise.all(entries.map((entry) => this.loadImage(entry.file)));
    this.manifest = manifest;
  }

  getCharacterFrame(pose: CharacterPose, color: string): SpriteFrame | null {
    const entry = this.manifest?.characters[CHARACTER_STYLE]?.frames[pose];
    const image = entry ? this.images.get(entry.file) : undefined;
    if (!entry || !image) {
      return null;
    }
    const key = `${entry.file}|${color}`;
    if (!this.tintedFrames.has(key)) {
      this.tintedFrames.set(key, createTintedCanvas(image, color));
    }
    return { ...entry, image: this.tintedFrames.get(key) as HTMLCanvasElement };
  }

  getIdleHeight(): number {
    return this.manifest?.characters[CHARACTER_STYLE]?.frames.idle.height ?? 1;
  }

  getItemFrame(kind: number): SpriteFrame | null {
    const items = this.manifest?.items ?? [];
    const entry = items[kind % Math.max(1, items.length)];
    const image = entry ? this.images.get(entry.file) : undefined;
    return entry && image ? { ...entry, image } : null;
  }

  getArenaImage(): HTMLImageElement | null {
    const entry = this.manifest?.arena.office;
    return entry ? (this.images.get(entry.file) ?? null) : null;
  }

  private loadImage(file: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        this.images.set(file, image);
        resolve();
      };
      image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${file}`));
      image.src = ASSET_BASE_URL + file;
    });
  }
}

// 흰색·회색(채도 낮고 밝은) 픽셀만 플레이어 색으로 바꾼다. 외곽선, 선글라스, 별은 그대로 둔다.
function createTintedCanvas(image: HTMLImageElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const tint = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index] ?? 0;
    const green = pixels.data[index + 1] ?? 0;
    const blue = pixels.data[index + 2] ?? 0;
    const brightest = Math.max(red, green, blue);
    if (brightest < TINT_MINIMUM_BRIGHTNESS || brightest - Math.min(red, green, blue) > TINT_MAXIMUM_SATURATION_RANGE) {
      continue;
    }
    tint.forEach((value, offset) => {
      pixels.data[index + offset] = Math.round((value * brightest) / 255);
    });
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}
