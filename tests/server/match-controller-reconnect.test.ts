import type { PlayerEntity, WorldState } from '../../src/game/game-types';

import { describe, expect, it } from 'vitest';

import { GAME_CONFIG } from '../../src/game/game-config';
import { createEmptyInput } from '../../src/game/player-factory';
import {
  createController,
  findMessage,
  findRosterPlayer,
  getSnapshotPhase,
  getSnapshotPlayer,
  playFirstQuestionCorrectly,
  runSeconds,
  runUntil,
  TICK_SECONDS,
} from './match-controller-helpers';

const { timeline, network } = GAME_CONFIG;
const GRACE_MILLISECONDS = network.reconnectGraceSeconds * 1000;

describe('MatchController — 끊김과 복귀', () => {
  it('대기실에서 끊기면 바로 나가고 복귀할 수 없다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.removePlayer('a', 0);
    expect(controller.hasPlayers()).toBe(false);
    expect(controller.resumePlayer('a')).toBeNull();
  });

  it('게임 중 끊기면 유예 동안 자리와 색을 유지하고, 같은 id로 돌아오면 경기장에 복귀한다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 2);
    controller.addPlayer('b', '나', 3);
    controller.startMatch();
    controller.removePlayer('a', 1000);
    expect(controller.hasSuspended()).toBe(true);
    expect(controller.isColorAvailable(2)).toBe(false);
    expect(findRosterPlayer(controller, 'a')?.isInWorld).toBe(false);
    expect(getSnapshotPlayer(controller, 'a')).toBeUndefined();
    expect(controller.resumePlayer('a')?.id).toBe('a');
    expect(getSnapshotPlayer(controller, 'a')).toBeDefined();
    expect(controller.hasSuspended()).toBe(false);
  });

  it('유예 시간이 지나면 완전히 내보낸다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 2);
    controller.addPlayer('b', '나', 3);
    controller.startMatch();
    controller.removePlayer('a', 1000);
    controller.tick(TICK_SECONDS, 1000 + GRACE_MILLISECONDS - 1);
    expect(controller.isColorAvailable(2)).toBe(false);
    const messages = controller.tick(TICK_SECONDS, 1000 + GRACE_MILLISECONDS);
    expect(findMessage(messages, 'roster')?.players.map((player) => player.id)).toEqual(['b']);
    expect(controller.isColorAvailable(2)).toBe(true);
    expect(controller.resumePlayer('a')).toBeNull();
  });

  it('아직 끊긴 것으로 처리되지 않은 자리도 같은 id로 돌려받는다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    expect(controller.resumePlayer('a')?.id).toBe('a');
    expect(getSnapshotPlayer(controller, 'a')).toBeDefined();
  });

  it('모르는 id로는 복귀할 수 없다', () => {
    expect(createController().resumePlayer('stranger')).toBeNull();
  });

  it('게임 중 전원이 끊기고 유예도 지나면 대기실로 돌아간다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.startMatch();
    controller.removePlayer('a', 0);
    expect(getSnapshotPhase(controller)).not.toBe('lobby');
    runSeconds(controller, 1, GRACE_MILLISECONDS);
    expect(getSnapshotPhase(controller)).toBe('lobby');
    expect(controller.hasPlayers()).toBe(false);
  });

  it('끊긴 채로 판이 끝나도 최종 순위에 들어간다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.addPlayer('b', '나', 1);
    controller.startMatch();
    playFirstQuestionCorrectly(controller, 'a');
    controller.removePlayer('a', 0);
    const finalMessages = runUntil(controller, 'finalResult', timeline.finalRevealDelaySeconds + 1);
    const rankings = findMessage(finalMessages, 'finalResult')?.rankings ?? [];
    expect(rankings.map((entry) => entry.playerId)).toEqual(['a', 'b']);
    expect(rankings[0]?.score).toBe(GAME_CONFIG.scoring.pointsPerCorrect);
  });

});

describe('MatchController — 들고 있는 중 끊김', () => {
  function startLifting() {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.addPlayer('b', '나', 1);
    controller.startMatch();
    const world = Reflect.get(controller, 'world') as WorldState;
    const thrower = world.players.get('a') as PlayerEntity;
    const target = world.players.get('b') as PlayerEntity;
    target.position = { x: thrower.position.x + 40, y: thrower.position.y };
    controller.setInput('a', { ...createEmptyInput(), isRightPressed: true });
    controller.setInput('a', { ...createEmptyInput(), isRightPressed: true, punchCount: 1 });
    controller.tick(TICK_SECONDS, 0);
    expect(thrower.state).toBe('lifting');
    return { controller, thrower, target };
  }

  it('든 사람이 끊기면 들린 사람이 풀려나 잠깐 무적이다', () => {
    const { controller, target } = startLifting();
    controller.removePlayer('a', 0);
    expect(target.state).toBe('free');
    expect(target.invincibleRemaining).toBe(GAME_CONFIG.throwing.releaseInvincibleSeconds);
  });

  it('든 사람이 끊겼다 돌아오면 빈손으로 드는 자세가 남지 않는다', () => {
    const { controller, thrower } = startLifting();
    controller.removePlayer('a', 0);
    expect(controller.resumePlayer('a')).not.toBeNull();
    expect(thrower.state).toBe('free');
    expect(thrower.grabbedTargetId).toBeNull();
  });

  it('들린 사람이 끊긴 사이 든 사람이 놓았으면, 돌아왔을 때 풀려나 무적이다', () => {
    const { controller, thrower, target } = startLifting();
    controller.removePlayer('b', 0);
    runSeconds(controller, GAME_CONFIG.throwing.holdSeconds);
    expect(thrower.state).toBe('free');
    expect(target.state).toBe('grabbed');
    expect(controller.resumePlayer('b')).not.toBeNull();
    controller.tick(TICK_SECONDS, 0);
    expect(target.state).toBe('free');
    expect(target.invincibleRemaining).toBeGreaterThan(0);
  });

  it('들린 사람의 유예가 끝나 완전히 나가면 든 사람이 바로 풀린다', () => {
    const { controller, thrower } = startLifting();
    controller.removePlayer('b', 0);
    controller.tick(TICK_SECONDS, (network.reconnectGraceSeconds + 1) * 1000);
    expect(thrower.state).toBe('free');
    expect(thrower.grabbedTargetId).toBeNull();
  });

  it('들린 사람이 끊겼다 돌아오면 여전히 들려 있고, 제한 시간이 지나면 풀려난다', () => {
    const { controller, thrower, target } = startLifting();
    controller.removePlayer('b', 0);
    expect(controller.resumePlayer('b')).not.toBeNull();
    expect(target.state).toBe('grabbed');
    runSeconds(controller, GAME_CONFIG.throwing.holdSeconds);
    expect(thrower.state).toBe('free');
    expect(target.state).toBe('free');
  });
});
