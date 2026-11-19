import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasViewport } from '../../src/client/canvas-viewport';

// 실제 캔버스처럼 save/restore로 클립이 쌓이고 풀리는 것만 흉내 내는 대역
function createFakeCanvas() {
  const savedClipCounts: number[] = [];
  const state = { clipCount: 0, transforms: [] as number[][] };
  const context = {
    fillStyle: '',
    save: () => savedClipCounts.push(state.clipCount),
    restore: () => {
      state.clipCount = savedClipCounts.pop() ?? state.clipCount;
    },
    clip: () => {
      state.clipCount += 1;
    },
    setTransform: (...values: number[]) => state.transforms.push(values),
    fillRect: () => undefined,
    beginPath: () => undefined,
    rect: () => undefined,
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  return { canvas: canvas as unknown as HTMLCanvasElement, state };
}

describe('CanvasViewport', () => {
  const listeners = new Map<string, () => void>();

  beforeEach(() => {
    listeners.clear();
    vi.stubGlobal('window', {
      innerWidth: 800,
      innerHeight: 900,
      devicePixelRatio: 2,
      addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('프레임을 아무리 그려도 클립이 쌓이지 않는다', () => {
    const { canvas, state } = createFakeCanvas();
    const viewport = new CanvasViewport(canvas, 1600, 900);
    for (let frame = 0; frame < 100; frame += 1) {
      viewport.beginFrame();
    }
    expect(state.clipCount).toBe(1);
  });

  it('캔버스를 화면 픽셀 크기에 맞추고, 게임 좌표를 비율을 유지한 채 가운데에 놓는다', () => {
    const { canvas, state } = createFakeCanvas();
    const viewport = new CanvasViewport(canvas, 1600, 900);
    expect([canvas.width, canvas.height]).toEqual([1600, 1800]);
    viewport.beginFrame();
    expect(state.transforms.at(-1)).toEqual([1, 0, 0, 1, 0, 450]);
  });

  it('창 크기가 바뀌면 캔버스 크기를 다시 맞춘다', () => {
    const { canvas } = createFakeCanvas();
    new CanvasViewport(canvas, 1600, 900);
    vi.stubGlobal('window', { innerWidth: 400, innerHeight: 300, devicePixelRatio: 0, addEventListener: () => undefined });
    listeners.get('resize')?.();
    expect([canvas.width, canvas.height]).toEqual([400, 300]);
  });
});
