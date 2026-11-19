import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

export function readPng(path) {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: png.data };
}

export function writePng(path, image) {
  const png = new PNG({ width: image.width, height: image.height });
  image.data.copy(png.data);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}

// 덩어리 번호(labels)가 box.memberIds에 속하는 픽셀만 남기고 자른다. 반투명 가장자리는 임계값 미만이라 함께 남긴다.
export function cropSprite(image, box, labels) {
  const cropped = cropImage(image, box);
  const members = new Set(box.memberIds);
  for (let row = 0; row < box.height; row += 1) {
    for (let column = 0; column < box.width; column += 1) {
      const sourceX = box.x + column;
      const sourceY = box.y + row;
      if (sourceX < 0 || sourceY < 0 || sourceX >= image.width || sourceY >= image.height) continue;
      const label = labels[sourceY * image.width + sourceX];
      if (label >= 0 && !members.has(label)) cropped.data[(row * box.width + column) * 4 + 3] = 0;
    }
  }
  return cropped;
}

export function cropImage(image, box) {
  const cropped = { width: box.width, height: box.height, data: Buffer.alloc(box.width * box.height * 4) };
  for (let row = 0; row < box.height; row += 1) {
    const sourceY = box.y + row;
    if (sourceY < 0 || sourceY >= image.height) continue;
    for (let column = 0; column < box.width; column += 1) {
      const sourceX = box.x + column;
      if (sourceX < 0 || sourceX >= image.width) continue;
      const sourceIndex = (sourceY * image.width + sourceX) * 4;
      image.data.copy(cropped.data, (row * box.width + column) * 4, sourceIndex, sourceIndex + 4);
    }
  }
  return cropped;
}

// 외곽선 위에 겹친 생성 도구 워터마크(회색 반짝이)를 외곽선 색으로 덮는다.
export function paintOverWatermark(image, region, outlineColor) {
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const index = (y * image.width + x) * 4;
      const channels = [image.data[index], image.data[index + 1], image.data[index + 2]];
      const isGrayish = Math.max(...channels) - Math.min(...channels) < 45 && Math.max(...channels) > 60;
      if (image.data[index + 3] > 0 && isGrayish) outlineColor.forEach((value, offset) => { image.data[index + offset] = value; });
    }
  }
}
