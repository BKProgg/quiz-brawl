import type { PlayerSnapshot } from '../../src/game/protocol-types';

import { describe, expect, it } from 'vitest';

import { CharacterLiftAnimator } from '../../src/client/character-lift-animator';
import { resolveCharacterPose } from '../../src/client/character-renderer';

function createPlayer(state: PlayerSnapshot['state'], progress = 0): PlayerSnapshot {
  return { id: 'p', x: 0, y: 0, facingSign: 1, state, progress, isBlocking: false, isInvincible: false, heldItemId: null, score: 0 };
}

describe('CharacterLiftAnimator', () => {
  it('평소에는 땅에 있다', () => {
    expect(new CharacterLiftAnimator().computeLift(createPlayer('free'), 0)).toBe(0);
  });

  it('들리면 머리 위까지 올라가 유지한다', () => {
    const animator = new CharacterLiftAnimator();
    const low = animator.computeLift(createPlayer('grabbed', 0.02), 0);
    const top = animator.computeLift(createPlayer('grabbed', 0.2), 100);
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(top);
    expect(animator.computeLift(createPlayer('grabbed', 0.9), 200)).toBe(top);
  });

  it('던져지면 머리 위 높이에서 이어서 내려온다', () => {
    const animator = new CharacterLiftAnimator();
    const top = animator.computeLift(createPlayer('grabbed', 0.5), 0);
    expect(animator.computeLift(createPlayer('airborne', 0), 10)).toBe(top);
    expect(animator.computeLift(createPlayer('airborne', 1), 450)).toBeCloseTo(0);
  });

  it('맞아서 날아가면 바닥 근처에서 포물선을 그린다', () => {
    const animator = new CharacterLiftAnimator();
    animator.computeLift(createPlayer('free'), 0);
    expect(animator.computeLift(createPlayer('airborne', 0), 10)).toBe(10);
    expect(animator.computeLift(createPlayer('airborne', 0.5), 100)).toBeCloseTo(80);
  });

  it('던져져 착지한 뒤 다음에 맞아 날아가면 다시 바닥에서 시작한다', () => {
    const animator = new CharacterLiftAnimator();
    animator.computeLift(createPlayer('grabbed', 0.5), 0);
    animator.computeLift(createPlayer('airborne', 0.5), 100);
    animator.computeLift(createPlayer('down'), 500);
    expect(animator.computeLift(createPlayer('airborne', 0), 600)).toBe(10);
  });

  it('풀려나면 잠깐 동안 내려온 뒤 땅에 닿는다', () => {
    const animator = new CharacterLiftAnimator();
    const top = animator.computeLift(createPlayer('grabbed', 0.5), 0);
    expect(animator.computeLift(createPlayer('free'), 1000)).toBe(top);
    const falling = animator.computeLift(createPlayer('free'), 1075);
    expect(falling).toBeCloseTo(top / 2);
    expect(animator.computeLift(createPlayer('free'), 1200)).toBe(0);
    expect(animator.computeLift(createPlayer('free'), 1300)).toBe(0);
  });
});

describe('CharacterLiftAnimator.reset', () => {
  it('다시 붙은 뒤에는 끊기기 전 들림·던져짐·떨어짐을 잊는다', () => {
    const animator = new CharacterLiftAnimator();
    animator.computeLift(createPlayer('grabbed', 0.5), 0);
    animator.reset();
    expect(animator.computeLift(createPlayer('free'), 10)).toBe(0);
    animator.computeLift(createPlayer('grabbed', 0.5), 20);
    animator.computeLift(createPlayer('airborne', 0), 30);
    animator.reset();
    expect(animator.computeLift(createPlayer('airborne', 0), 40)).toBe(10);
  });
});

describe('resolveCharacterPose', () => {
  it('사람을 들고 있으면 드는 자세, 들린 사람은 공중 자세다', () => {
    expect(resolveCharacterPose(createPlayer('lifting'), false, 0)).toBe('hold');
    expect(resolveCharacterPose(createPlayer('grabbed'), false, 0)).toBe('airborne');
  });
});
