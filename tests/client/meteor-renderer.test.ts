import type { MeteorSnapshot } from '../../src/game/protocol-types';

import { describe, expect, it } from 'vitest';

import { drawMeteors, drawMeteorWarnings } from '../../src/client/meteor-renderer';
import { GAME_CONFIG } from '../../src/game/game-config';

// 그림 자체는 브라우저에서 확인한다. 여기서는 어느 상태에서 무엇을 그리는지(분기)만 본다.
function createFakeContext() {
  const counts = { arc: 0 };
  const context = new Proxy({} as Record<string | symbol, unknown>, {
    get: (_target, property) => {
      if (property === 'createRadialGradient') {
        return () => ({ addColorStop: () => undefined });
      }
      return property === 'arc' ? () => { counts.arc += 1; } : () => undefined;
    },
    set: () => true,
  });
  return { ctx: context as unknown as CanvasRenderingContext2D, counts };
}

function createMeteor(state: MeteorSnapshot['state'], progress: number): MeteorSnapshot {
  return { id: 'meteor-1', x: 800, y: 480, state, progress };
}

describe('meteor-renderer', () => {
  it('바닥 경고는 경고 상태에서만 그린다', () => {
    const warning = createFakeContext();
    drawMeteorWarnings(warning.ctx, [createMeteor('warning', 0.5)], GAME_CONFIG, 0);
    expect(warning.counts.arc).toBeGreaterThan(0);
    const impact = createFakeContext();
    drawMeteorWarnings(impact.ctx, [createMeteor('impact', 0.5)], GAME_CONFIG, 0);
    expect(impact.counts.arc).toBe(0);
  });

  it('유성은 경고 초반에는 보이지 않다가 떨어지기 시작하면 그린다', () => {
    const early = createFakeContext();
    drawMeteors(early.ctx, [createMeteor('warning', 0.1)], GAME_CONFIG, 0);
    expect(early.counts.arc).toBe(0);
    const falling = createFakeContext();
    drawMeteors(falling.ctx, [createMeteor('warning', 0.8)], GAME_CONFIG, 0);
    expect(falling.counts.arc).toBeGreaterThan(0);
  });

  it('충돌 화염을 그린다', () => {
    const impact = createFakeContext();
    drawMeteors(impact.ctx, [createMeteor('impact', 0.5)], GAME_CONFIG, 0);
    expect(impact.counts.arc).toBeGreaterThan(0);
  });
});
