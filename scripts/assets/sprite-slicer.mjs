const ALPHA_THRESHOLD = 40;
const NEIGHBOR_OFFSETS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// 투명 배경 이미지에서 덩어리(연결 요소)를 찾고, 작은 조각(별, 링 등)은 가장 가까운 큰 덩어리에 붙인다.
// 반환값의 labels는 픽셀별 덩어리 번호이며, 잘라낼 때 이웃 그림이 섞이지 않게 하는 마스크로 쓴다.
export function findSpriteBoxes(image, options) {
  const { components: allComponents, labels } = labelComponents(image);
  const components = allComponents.filter((component) => component.area >= options.minimumPieceArea);
  const mains = components.filter((component) => component.area >= options.minimumSpriteArea);
  components.filter((component) => component.area < options.minimumSpriteArea).forEach((piece) => {
    const nearest = findNearestBox(mains, piece);
    if (nearest && boxDistance(nearest, piece) <= options.attachDistance) mergeBox(nearest, piece);
  });
  if (mains.length !== options.expectedCount) {
    throw new Error(`스프라이트 개수 불일치: 기대 ${options.expectedCount}, 실제 ${mains.length}`);
  }
  const boxes = sortByRowThenColumn(mains, options.rowSplitY).map((box) => ({ ...padBox(box, options.padding), memberIds: box.memberIds }));
  return { boxes, labels };
}

function labelComponents(image) {
  const { width, height, data } = image;
  const labels = new Int32Array(width * height).fill(-1);
  const stack = new Int32Array(width * height);
  const components = [];
  for (let start = 0; start < width * height; start += 1) {
    if (labels[start] >= 0 || data[start * 4 + 3] < ALPHA_THRESHOLD) continue;
    const componentId = components.length;
    const box = { left: width, top: height, right: 0, bottom: 0, area: 0, memberIds: [componentId] };
    let stackSize = 0;
    stack[stackSize++] = start;
    labels[start] = componentId;
    while (stackSize > 0) {
      const current = stack[--stackSize];
      const x = current % width;
      const y = (current - x) / width;
      expandBox(box, x, y);
      for (const [offsetX, offsetY] of NEIGHBOR_OFFSETS) {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (labels[next] >= 0 || data[next * 4 + 3] < ALPHA_THRESHOLD) continue;
        labels[next] = componentId;
        stack[stackSize++] = next;
      }
    }
    components.push(box);
  }
  return { components, labels };
}

function expandBox(box, x, y) {
  box.left = Math.min(box.left, x);
  box.top = Math.min(box.top, y);
  box.right = Math.max(box.right, x);
  box.bottom = Math.max(box.bottom, y);
  box.area += 1;
}

function boxDistance(first, second) {
  const gapX = Math.max(0, Math.max(first.left, second.left) - Math.min(first.right, second.right));
  const gapY = Math.max(0, Math.max(first.top, second.top) - Math.min(first.bottom, second.bottom));
  return Math.hypot(gapX, gapY);
}

function findNearestBox(boxes, target) {
  return boxes.reduce((nearest, box) => (!nearest || boxDistance(box, target) < boxDistance(nearest, target) ? box : nearest), null);
}

function mergeBox(target, piece) {
  target.left = Math.min(target.left, piece.left);
  target.top = Math.min(target.top, piece.top);
  target.right = Math.max(target.right, piece.right);
  target.bottom = Math.max(target.bottom, piece.bottom);
  target.memberIds.push(...piece.memberIds);
}

function sortByRowThenColumn(boxes, rowSplitY) {
  const rowOf = (box) => ((box.top + box.bottom) / 2 < rowSplitY ? 0 : 1);
  return [...boxes].sort((first, second) => rowOf(first) - rowOf(second) || first.left - second.left);
}

function padBox(box, padding) {
  return {
    x: box.left - padding,
    y: box.top - padding,
    width: box.right - box.left + 1 + padding * 2,
    height: box.bottom - box.top + 1 + padding * 2,
  };
}
