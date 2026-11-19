import type { MeteorSnapshot, PlayerSnapshot } from '../../src/game/protocol-types';
import type { SnapshotMessage } from '../../src/client/snapshot-interpolator';

import { describe, expect, it } from 'vitest';

import { EffectsManager } from '../../src/client/effects-renderer';
import { SnapshotInterpolator } from '../../src/client/snapshot-interpolator';

function createMeteor(state: MeteorSnapshot['state'], progress: number): MeteorSnapshot {
  return { id: 'meteor-1', x: 800, y: 480, state, progress };
}

function createSnapshot(serverTime: number, meteors: MeteorSnapshot[]): SnapshotMessage {
  return { type: 'snapshot', serverTime, phase: 'question', phaseRemaining: 10, players: [], items: [], logs: [], meteors };
}

describe('메테오 보간', () => {
  it('같은 상태면 진행도를 두 스냅샷 사이로 보간한다', () => {
    const interpolator = new SnapshotInterpolator();
    interpolator.push(createSnapshot(1000, [createMeteor('warning', 0.2)]), 1000);
    interpolator.push(createSnapshot(1100, [createMeteor('warning', 0.4)]), 1100);
    expect(interpolator.getView(1150).meteors[0]?.progress).toBeCloseTo(0.3);
  });

  it('경고에서 충돌로 넘어가는 구간과 새로 나타난 메테오는 보간하지 않는다', () => {
    const interpolator = new SnapshotInterpolator();
    interpolator.push(createSnapshot(1000, []), 1000);
    interpolator.push(createSnapshot(1100, [createMeteor('warning', 0.1)]), 1100);
    interpolator.push(createSnapshot(1200, [createMeteor('impact', 0.05)]), 1200);
    expect(interpolator.getView(1150).meteors[0]?.progress).toBe(0.1);
    expect(interpolator.getView(1250).meteors[0]).toMatchObject({ state: 'impact', progress: 0.05 });
  });
});

describe('화면 흔들림', () => {
  const PLAYER: PlayerSnapshot = {
    id: 'p',
    x: 0,
    y: 0,
    facingSign: 1,
    state: 'free',
    progress: 0,
    isBlocking: false,
    isInvincible: false,
    heldItemId: null,
    score: 0,
  };
  const isShaking = (effects: EffectsManager, now: number) => {
    const offset = effects.getShakeOffset(now);
    return offset.x !== 0 || offset.y !== 0;
  };

  function observeStateChange(effects: EffectsManager, state: PlayerSnapshot['state'], ownPlayerId: string | null, now: number): void {
    effects.observePlayers([PLAYER], ownPlayerId, now - 1);
    effects.observePlayers([{ ...PLAYER, state }], ownPlayerId, now);
  }

  it('경고 중에는 흔들리지 않고, 착지 순간에 한 번만 흔들린다', () => {
    const effects = new EffectsManager();
    effects.observeMeteors([createMeteor('warning', 0.9)], 100);
    expect(isShaking(effects, 110)).toBe(false);
    effects.observeMeteors([createMeteor('impact', 0)], 200);
    expect(isShaking(effects, 210)).toBe(true);
    effects.observeMeteors([createMeteor('impact', 0.5)], 1000);
    expect(isShaking(effects, 1010)).toBe(false);
  });

  it.each(['stunned', 'airborne', 'down'] as const)('내가 %s 상태가 되면 흔들리고, 다른 사람이나 관리자 화면에서는 흔들리지 않는다', (state) => {
    const own = new EffectsManager();
    observeStateChange(own, state, 'p', 100);
    expect(isShaking(own, 110)).toBe(true);
    const other = new EffectsManager();
    observeStateChange(other, state, 'someone-else', 100);
    expect(isShaking(other, 110)).toBe(false);
    const admin = new EffectsManager();
    observeStateChange(admin, state, null, 100);
    expect(isShaking(admin, 110)).toBe(false);
  });

  it('던져질 때는 맞은 효과를 내지 않는다', () => {
    const effects = new EffectsManager();
    effects.observePlayers([{ ...PLAYER, state: 'grabbed' }], 'p', 100);
    effects.observePlayers([{ ...PLAYER, state: 'airborne' }], 'p', 200);
    expect(effects.getFlashAmount('p', 200)).toBe(0);
    expect(isShaking(effects, 210)).toBe(false);
  });

  it('센 흔들림 중의 약한 타격은 흔들림을 새로 시작하지 않는다', () => {
    const effects = new EffectsManager();
    effects.observeMeteors([createMeteor('impact', 0)], 1000);
    observeStateChange(effects, 'stunned', 'p', 1010);
    expect(isShaking(effects, 1250)).toBe(true);
    expect(isShaking(effects, 1265)).toBe(false);
  });

  it('다시 붙으면 끊기기 전에 맞아서 번쩍이던 기록도 지운다', () => {
    const effects = new EffectsManager();
    observeStateChange(effects, 'stunned', null, 100);
    expect(effects.getFlashAmount('p', 100)).toBe(1);
    effects.reset();
    expect(effects.getFlashAmount('p', 100)).toBe(0);
  });

  it('다시 붙은 뒤에는 끊기기 전 상태와 비교하지 않고, 같은 메테오의 충돌도 다시 인식한다', () => {
    const effects = new EffectsManager();
    effects.observePlayers([PLAYER], 'p', 100);
    effects.observeMeteors([createMeteor('impact', 0)], 100);
    effects.reset();
    effects.observePlayers([{ ...PLAYER, state: 'stunned' }], 'p', 1000);
    expect(effects.getFlashAmount('p', 1000)).toBe(0);
    expect(isShaking(effects, 1010)).toBe(false);
    effects.observeMeteors([createMeteor('impact', 0)], 1100);
    expect(isShaking(effects, 1110)).toBe(true);
  });
});

describe('효과 그리기', () => {
  // 실제 캔버스처럼 반지름이 음수면 예외를 던지는 대역
  function createStrictContext() {
    const radii: number[] = [];
    const record = (radius: number): void => {
      if (radius < 0) {
        throw new RangeError('negative radius');
      }
      radii.push(radius);
    };
    const context = new Proxy({} as Record<string | symbol, unknown>, {
      get: (_target, property) => {
        if (property === 'ellipse') {
          return (_x: number, _y: number, radiusX: number) => record(radiusX);
        }
        if (property === 'createRadialGradient') {
          return () => ({ addColorStop: () => undefined });
        }
        return property === 'arc' ? (_x: number, _y: number, radius: number) => record(radius) : () => undefined;
      },
      set: () => true,
    });
    return { ctx: context as unknown as CanvasRenderingContext2D, radii };
  }
  const PLAYER: PlayerSnapshot = {
    id: 'p', x: 0, y: 0, facingSign: 1, state: 'free', progress: 0, isBlocking: false, isInvincible: false, heldItemId: null, score: 0,
  };

  it('그리는 시각이 효과 시작보다 앞서도 반지름이 음수가 되지 않는다', () => {
    const effects = new EffectsManager();
    effects.observePlayers([PLAYER], null, 999);
    effects.observePlayers([{ ...PLAYER, state: 'down' }], null, 1000);
    const { ctx, radii } = createStrictContext();
    expect(() => effects.draw(ctx, 800)).not.toThrow();
    expect(radii.length).toBeGreaterThan(0);
  });
});
