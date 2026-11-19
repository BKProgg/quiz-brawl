// AI로 생성한 원본 이미지(assets-source/)를 게임용 투명 PNG(public/assets/)로 가공한다.
// 실행: npm run assets
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { readPng, writePng, cropSprite, paintOverWatermark } from './assets/image-buffer.mjs';
import { removeGreenBackground } from './assets/chroma-key.mjs';
import { findSpriteBoxes } from './assets/sprite-slicer.mjs';

const SOURCE_DIRECTORY = 'assets-source';
const OUTPUT_DIRECTORY = 'public/assets';
const CHARACTER_POSES = ['idle', 'walk', 'punch', 'kick', 'block', 'hold', 'stunned', 'airborne', 'down', 'cheer'];
const CHARACTER_STYLES = ['cute', 'visor'];
const ITEM_COUNT = 6;
// 소품 시트의 오리 위에 겹친 생성 도구 워터마크(반짝이) 위치
const PROPS_WATERMARK_REGION = { x: 880, y: 880, width: 50, height: 50 };
const OUTLINE_COLOR = [17, 20, 39];
const SLICE_OPTIONS = {minimumPieceArea: 12, minimumSpriteArea: 2500, attachDistance: 40, rowSplitY: 360, padding: 4 };

function processCharacterStyle(style) {
  const sheet = removeGreenBackground(readPng(`${SOURCE_DIRECTORY}/${style}-actions.png`));
  const { boxes, labels } = findSpriteBoxes(sheet, { ...SLICE_OPTIONS, expectedCount: CHARACTER_POSES.length });
  const frames = {};
  boxes.forEach((box, index) => {
    const pose = CHARACTER_POSES[index];
    const file = `characters/${style}/${pose}.png`;
    writePng(`${OUTPUT_DIRECTORY}/${file}`, cropSprite(sheet, box, labels));
    frames[pose] = { file, width: box.width, height: box.height };
  });
  const portrait = removeGreenBackground(readPng(`${SOURCE_DIRECTORY}/${style}-base.png`));
  const { boxes: [portraitBox], labels: portraitLabels } = findSpriteBoxes(portrait, { ...SLICE_OPTIONS, expectedCount: 1 });
  const portraitFile = `characters/${style}/portrait.png`;
  writePng(`${OUTPUT_DIRECTORY}/${portraitFile}`, cropSprite(portrait, portraitBox, portraitLabels));
  return { frames, portrait: { file: portraitFile, width: portraitBox.width, height: portraitBox.height } };
}

function processItems() {
  const sheet = removeGreenBackground(readPng(`${SOURCE_DIRECTORY}/office-props.png`));
  paintOverWatermark(sheet, PROPS_WATERMARK_REGION, OUTLINE_COLOR);
  const { boxes, labels } = findSpriteBoxes(sheet, { ...SLICE_OPTIONS, expectedCount: ITEM_COUNT, rowSplitY: 512 });
  return boxes.map((box, index) => {
    const file = `items/item-${index}.png`;
    writePng(`${OUTPUT_DIRECTORY}/${file}`, cropSprite(sheet, box, labels));
    return { file, width: box.width, height: box.height };
  });
}

function copyArena(name) {
  const file = `arena/${name}.png`;
  const image = readPng(`${SOURCE_DIRECTORY}/arena-${name}.png`);
  mkdirSync(`${OUTPUT_DIRECTORY}/arena`, { recursive: true });
  copyFileSync(`${SOURCE_DIRECTORY}/arena-${name}.png`, `${OUTPUT_DIRECTORY}/${file}`);
  return { file, width: image.width, height: image.height };
}

const characters = Object.fromEntries(CHARACTER_STYLES.map((style) => [style, processCharacterStyle(style)]));
const manifest = { characters, items: processItems(), arena: { office: copyArena('office') } };
writeFileSync(`${OUTPUT_DIRECTORY}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`에셋 가공 완료: 캐릭터 ${CHARACTER_STYLES.length}종, 아이템 ${manifest.items.length}종`);
