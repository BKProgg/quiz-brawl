// 캐릭터는 모두 같은 모양이고 색만 다르다. 닉네임 대신 색 이름으로 부른다.
export interface CharacterColor {
  name: string;
  hex: string;
}

export const CHARACTER_PALETTE: readonly CharacterColor[] = [
  { name: '빨강', hex: '#ff5a5f' },
  { name: '주황', hex: '#ff8a3d' },
  { name: '노랑', hex: '#ffc93c' },
  { name: '연두', hex: '#9ad94a' },
  { name: '초록', hex: '#2ec27e' },
  { name: '하늘', hex: '#4cc3ff' },
  { name: '파랑', hex: '#3d6bfd' },
  { name: '보라', hex: '#9b5de5' },
  { name: '분홍', hex: '#ff8fc7' },
  { name: '갈색', hex: '#a47551' },
  { name: '회색', hex: '#9aa5b8' },
  { name: '흰색', hex: '#e9edf2' },
];

export const CHARACTER_COLOR_COUNT = CHARACTER_PALETTE.length;

export function isValidColorIndex(colorIndex: number): boolean {
  return Number.isSafeInteger(colorIndex) && colorIndex >= 0 && colorIndex < CHARACTER_COLOR_COUNT;
}

export function getCharacterColorName(colorIndex: number): string {
  return CHARACTER_PALETTE[colorIndex]?.name ?? '';
}

export function getCharacterColorHex(colorIndex: number): string {
  return CHARACTER_PALETTE[colorIndex]?.hex ?? '#ffffff';
}
