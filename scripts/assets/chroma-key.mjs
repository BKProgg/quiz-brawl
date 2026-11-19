const TRANSPARENT_GREENNESS = 90;
const OPAQUE_GREENNESS = 30;
const DESPILL_GREENNESS = 8;

// 초록 단색 배경을 투명으로 바꾸고, 가장자리에 번진 초록빛(spill)을 제거한다.
export function removeGreenBackground(image) {
  const { data } = image;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const greenness = green - Math.max(red, blue);
    if (greenness >= TRANSPARENT_GREENNESS) {
      data[index + 3] = 0;
      continue;
    }
    if (greenness > OPAQUE_GREENNESS) {
      const opacity = 1 - (greenness - OPAQUE_GREENNESS) / (TRANSPARENT_GREENNESS - OPAQUE_GREENNESS);
      data[index + 3] = Math.round(data[index + 3] * opacity);
    }
    if (greenness > DESPILL_GREENNESS) data[index + 1] = Math.max(red, blue);
  }
  return image;
}
