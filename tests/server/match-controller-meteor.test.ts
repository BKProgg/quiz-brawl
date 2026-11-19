import type { WorldState } from '../../src/game/game-types';
import type { MatchController } from '../../src/server/match-controller';

import { describe, expect, it } from 'vitest';

import { GAME_CONFIG } from '../../src/game/game-config';
import { createController, getSnapshotPlayer, runSeconds, TICK_SECONDS } from './match-controller-helpers';

const { timeline, meteor: METEOR } = GAME_CONFIG;

function getMeteors(controller: MatchController) {
  const snapshot = controller.buildSnapshot(0);
  return snapshot.type === 'snapshot' ? snapshot.meteors : [];
}

function getWorld(controller: MatchController): WorldState {
  return Reflect.get(controller, 'world') as WorldState;
}

function startFirstQuestion(): MatchController {
  const controller = createController();
  controller.addPlayer('a', '가', 0);
  controller.addPlayer('b', '나', 1);
  controller.startMatch();
  runSeconds(controller, timeline.introBrawlSeconds);
  return controller;
}

// 문제가 시작된 뒤 메테오 경고가 뜰 때까지 돌리고, 걸린 시간을 돌려준다.
function runUntilMeteor(controller: MatchController): number {
  let elapsed = 0;
  while (getMeteors(controller).length === 0 && elapsed < timeline.answerCountdownSeconds) {
    controller.tick(TICK_SECONDS, 0);
    elapsed += TICK_SECONDS;
  }
  return elapsed;
}

// 메테오 경고가 뜬 뒤 착지까지 돌린다. 지정한 사람을 원 안에 세워 맞게 한다.
function strikePlayer(controller: MatchController, playerId: string): void {
  runUntilMeteor(controller);
  const [meteor] = getMeteors(controller);
  const player = getWorld(controller).players.get(playerId);
  if (meteor && player) {
    player.position = { x: meteor.x + 50, y: meteor.y };
  }
  runSeconds(controller, METEOR.warningSeconds + TICK_SECONDS);
}

describe('MatchController — 메테오', () => {
  it('대기실과 시작 직후에는 나오지 않는다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    runSeconds(controller, 40);
    expect(getMeteors(controller)).toEqual([]);
    controller.startMatch();
    runSeconds(controller, timeline.introBrawlSeconds);
    expect(getMeteors(controller)).toEqual([]);
  });

  it('문제 중 판정 5~8초 전에 착지하고, 판정 전에 사라진다', () => {
    const controller = startFirstQuestion();
    const startElapsed = runUntilMeteor(controller);
    const landRemaining = timeline.answerCountdownSeconds - startElapsed - METEOR.warningSeconds;
    expect(landRemaining).toBeGreaterThanOrEqual(METEOR.minLandRemainingSeconds - TICK_SECONDS);
    expect(landRemaining).toBeLessThanOrEqual(METEOR.maxLandRemainingSeconds + TICK_SECONDS);
    expect(getMeteors(controller)[0]).toMatchObject({ state: 'warning' });
    runSeconds(controller, METEOR.warningSeconds / 2);
    expect(getMeteors(controller)[0]?.progress).toBeCloseTo(0.5, 1);
    runSeconds(controller, METEOR.warningSeconds / 2 + TICK_SECONDS * 2);
    expect(getMeteors(controller)[0]).toMatchObject({ state: 'impact' });
    runSeconds(controller, METEOR.impactSeconds / 2);
    expect(getMeteors(controller)[0]?.progress).toBeCloseTo(0.5, 0);
    runSeconds(controller, METEOR.impactSeconds / 2);
    expect(getMeteors(controller)).toEqual([]);
  });

  it('스냅샷에는 위치와 진행도만 나가고 정답 정보는 없다', () => {
    const controller = startFirstQuestion();
    runUntilMeteor(controller);
    expect(Object.keys(getMeteors(controller)[0] ?? {}).sort()).toEqual(['id', 'progress', 'state', 'x', 'y']);
  });

  it('맞으면 스냅샷에 공중 상태로 나가고 착지하면 1.5초 쓰러진다', () => {
    const controller = startFirstQuestion();
    strikePlayer(controller, 'a');
    expect(getSnapshotPlayer(controller, 'a')?.state).toBe('airborne');
    runSeconds(controller, GAME_CONFIG.knockdownLaunch.airborneSeconds);
    expect(getSnapshotPlayer(controller, 'a')?.state).toBe('down');
    expect(getWorld(controller).players.get('a')?.stateDuration).toBe(METEOR.downSeconds);
  });

  it('공중에서 끊겼다 복귀해도 착지 후 1.5초 쓰러진다', () => {
    const controller = startFirstQuestion();
    strikePlayer(controller, 'a');
    controller.removePlayer('a', 0);
    expect(controller.resumePlayer('a')).not.toBeNull();
    runSeconds(controller, GAME_CONFIG.knockdownLaunch.airborneSeconds);
    expect(getWorld(controller).players.get('a')?.stateDuration).toBe(METEOR.downSeconds);
  });

  it('끊겨 유예 중인 사람은 맞지 않는다', () => {
    const controller = startFirstQuestion();
    runUntilMeteor(controller);
    const suspended = getWorld(controller).players.get('b');
    const [meteor] = getMeteors(controller);
    if (suspended && meteor) {
      suspended.position = { x: meteor.x, y: meteor.y };
    }
    controller.removePlayer('b', 0);
    runSeconds(controller, METEOR.warningSeconds + TICK_SECONDS);
    expect(suspended?.state).toBe('free');
  });

  it('경기장이 비어 대기실로 돌아가면 떨어지던 메테오도 지운다', () => {
    const controller = startFirstQuestion();
    runUntilMeteor(controller);
    expect(getMeteors(controller)).toHaveLength(1);
    controller.removePlayer('a', 0);
    controller.removePlayer('b', 0);
    controller.tick(TICK_SECONDS, (GAME_CONFIG.network.reconnectGraceSeconds + 1) * 1000);
    expect(getMeteors(controller)).toEqual([]);
  });
});
