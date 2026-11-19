import { describe, expect, it } from 'vitest';

import { applyStrikeHit, collectStrikeHits, isPlayerHittable, registerHit, startStrike } from '../../src/game/combat-resolver';
import { addTestItem, addTestPlayer, ARENA_CENTER, CONFIG, createTestWorld, offsetPosition } from './test-helpers';

function createDuel() {
  const world = createTestWorld();
  const attacker = addTestPlayer(world, 'attacker', ARENA_CENTER);
  const target = addTestPlayer(world, 'target', offsetPosition(ARENA_CENTER, CONFIG.punch.range));
  return { world, attacker, target };
}

describe('isPlayerHittable', () => {
  it('무적 시간에는 맞지 않는다', () => {
    const { target } = createDuel();
    target.invincibleRemaining = 0.5;
    expect(isPlayerHittable(target)).toBe(false);
  });

  it.each(['airborne', 'down', 'grabbed'] as const)('%s 상태에서는 맞지 않는다', (state) => {
    const { target } = createDuel();
    target.state = state;
    expect(isPlayerHittable(target)).toBe(false);
  });

  it('자유 상태에서는 맞는다', () => {
    expect(isPlayerHittable(createDuel().target)).toBe(true);
  });
});

describe('collectStrikeHits', () => {
  it('타격 시점 전에는 판정하지 않는다', () => {
    const { world, attacker } = createDuel();
    startStrike(attacker, 'punch', CONFIG);
    expect(collectStrikeHits(attacker, world, CONFIG)).toEqual([]);
    expect(attacker.hasAttackResolved).toBe(false);
  });

  it('타격 시점에 사거리 안의 상대를 모으고, 한 번만 판정한다', () => {
    const { world, attacker, target } = createDuel();
    startStrike(attacker, 'punch', CONFIG);
    attacker.stateElapsed = CONFIG.punch.hitTimeSeconds;
    expect(collectStrikeHits(attacker, world, CONFIG).map((hit) => hit.target)).toEqual([target]);
    expect(collectStrikeHits(attacker, world, CONFIG)).toEqual([]);
  });

  it('맞을 수 없는 상대는 모으지 않는다', () => {
    const { world, attacker, target } = createDuel();
    target.state = 'down';
    startStrike(attacker, 'punch', CONFIG);
    attacker.stateElapsed = CONFIG.punch.hitTimeSeconds;
    expect(collectStrikeHits(attacker, world, CONFIG)).toEqual([]);
  });

  it('발차기가 빗나가면 빈틈(후딜)이 늘어난다', () => {
    const { world, attacker, target } = createDuel();
    target.position = offsetPosition(ARENA_CENTER, 300);
    startStrike(attacker, 'kick', CONFIG);
    attacker.stateElapsed = CONFIG.kick.hitTimeSeconds;
    expect(collectStrikeHits(attacker, world, CONFIG)).toEqual([]);
    expect(attacker.stateDuration).toBeCloseTo(CONFIG.kick.durationSeconds + CONFIG.kick.missRecoverySeconds);
  });

  it('발차기가 맞으면 빈틈이 늘지 않는다', () => {
    const { world, attacker } = createDuel();
    startStrike(attacker, 'kick', CONFIG);
    attacker.stateElapsed = CONFIG.kick.hitTimeSeconds;
    expect(collectStrikeHits(attacker, world, CONFIG)).toHaveLength(1);
    expect(attacker.stateDuration).toBe(CONFIG.kick.durationSeconds);
  });

  it('공격 중이 아니면 아무것도 모으지 않는다', () => {
    const { world, attacker } = createDuel();
    expect(collectStrikeHits(attacker, world, CONFIG)).toEqual([]);
  });
});

describe('applyStrikeHit', () => {
  it('맞을 수 없는 상대는 무시한다', () => {
    const { world, attacker, target } = createDuel();
    target.state = 'down';
    expect(applyStrikeHit(attacker, target, 'punch', world, CONFIG)).toBe('ignored');
  });

  it('막기 중이면 밀려나기만 하고 경직·다운 카운트가 없다', () => {
    const { world, attacker, target } = createDuel();
    target.isBlocking = true;
    expect(applyStrikeHit(attacker, target, 'kick', world, CONFIG)).toBe('blocked');
    expect(target.state).toBe('free');
    expect(target.recentHitTimes).toHaveLength(0);
    expect(target.knockback.x).toBeCloseTo(CONFIG.block.pushbackSpeed);
  });

  it('맞으면 경직되고 들고 있던 아이템을 떨어뜨린다', () => {
    const { world, attacker, target } = createDuel();
    const item = addTestItem(world, 'item', target.position, { state: 'held', holderId: target.id });
    target.heldItemId = item.id;
    expect(applyStrikeHit(attacker, target, 'punch', world, CONFIG)).toBe('stunned');
    expect(target.heldItemId).toBeNull();
    expect(item.state).toBe('floor');
  });

  it('짧은 시간에 연속으로 맞으면 다운된다', () => {
    const { world, attacker, target } = createDuel();
    applyStrikeHit(attacker, target, 'punch', world, CONFIG);
    target.state = 'free';
    applyStrikeHit(attacker, target, 'punch', world, CONFIG);
    target.state = 'free';
    expect(applyStrikeHit(attacker, target, 'punch', world, CONFIG)).toBe('down');
    // 연타 다운은 뒤로 붕 날아간 뒤(airborne) 착지하면서 쓰러진다.
    expect(target.state).toBe('airborne');
    expect(target.recentHitTimes).toHaveLength(0);
  });

  it('잡고 있던 사람이 맞으면 잡힌 상대가 풀려난다', () => {
    const { world, attacker, target } = createDuel();
    const grabbed = addTestPlayer(world, 'grabbed', offsetPosition(ARENA_CENTER, 100));
    target.state = 'lifting';
    target.grabbedTargetId = grabbed.id;
    grabbed.state = 'grabbed';
    grabbed.grabbedById = target.id;
    applyStrikeHit(attacker, target, 'punch', world, CONFIG);
    expect(grabbed.state).toBe('free');
    expect(target.grabbedTargetId).toBeNull();
  });
});

describe('registerHit', () => {
  it('다운 판정 시간이 지난 피격은 세지 않는다', () => {
    const { target } = createDuel();
    registerHit(target, 0, CONFIG);
    registerHit(target, 0.1, CONFIG);
    expect(registerHit(target, CONFIG.down.hitWindowSeconds + 0.5, CONFIG)).toBe(false);
    expect(target.recentHitTimes).toHaveLength(1);
  });
});
