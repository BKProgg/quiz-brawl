'use strict';

const SHEET_NAMES = ['김버그', '이배포', '박리뷰', '최커밋', '정머지', '윤로그', '장캐시', '강핫픽스', '임쿼리', '한테스트'];
const SHEET_POSES = [
  ['idle', '기본'], ['walk', '걷기'], ['punch', '주먹 (Z)'], ['kick', '발차기 (X)'], ['block', '막기 (C)'],
  ['hold', '아이템 들기'], ['stunned', '맞음 (경직)'], ['airborne', '던져짐'], ['down', '다운'], ['cheer', '우승'],
];

function drawCharacterSheet(ctx, time) {
  ctx.fillStyle = '#f4f6fa';
  ctx.fillRect(0, 0, 1600, 820);
  drawSheetLabel(ctx, '색상 10종 × 체형 5종 (외형만 다르고 리치·파워·판정은 모두 동일)', 40);
  CHARACTER_COLORS.forEach((color, index) => {
    drawCharacter(ctx, {
      x: 120 + index * 151, y: 250, color, variant: index % BODY_VARIANTS.length, pose: index % 2 === 0 ? 'idle' : 'walk',
      facing: index < 5 ? 1 : -1, time: time + index * 0.3, scale: 1.45, nickname: SHEET_NAMES[index], isSelf: index === 2,
    });
  });
  drawSheetLabel(ctx, '동작', 320);
  SHEET_POSES.forEach(([pose, label], index) => {
    const x = 120 + index * 151;
    drawCharacter(ctx, {
      x, y: 530, color: CHARACTER_COLORS[1], variant: 0, pose, facing: 1, time, scale: 1.45, itemKind: 0, crown: pose === 'cheer',
    });
    drawSheetCaption(ctx, label, x, 580);
  });
  drawSheetLabel(ctx, '바닥 잡동사니 (Z로 줍고 다시 Z로 던짐, 맞으면 다운)', 630);
  ITEM_NAMES.forEach((name, index) => {
    const x = 160 + index * 250;
    drawItemShadow(ctx, x, 720, 1.5);
    drawItem(ctx, index, x, 720, 0, 1.6);
    drawSheetCaption(ctx, name, x, 790);
  });
}

function drawSheetLabel(ctx, text, y) {
  ctx.fillStyle = '#495057';
  ctx.font = '24px Jua, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 40, y);
}

function drawSheetCaption(ctx, text, x, y) {
  ctx.fillStyle = '#343a40';
  ctx.font = '20px Jua, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
