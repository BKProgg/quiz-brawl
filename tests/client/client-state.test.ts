import type { SnapshotMessage } from '../../src/client/snapshot-interpolator';
import type { PlayerSnapshot } from '../../src/game/protocol-types';

import { describe, expect, it } from 'vitest';

import { applyServerMessage, createClientState, getPhaseRemaining, isSpectating } from '../../src/client/client-state';
import { SnapshotInterpolator } from '../../src/client/snapshot-interpolator';
import { GAME_CONFIG } from '../../src/game/game-config';

function createPlayerSnapshot(id: string, x: number): PlayerSnapshot {
  return { id, x, y: 400, facingSign: 1, state: 'free', progress: 0, isBlocking: false, isInvincible: false, heldItemId: null, score: 0 };
}

function createSnapshot(serverTime: number, players: PlayerSnapshot[]): SnapshotMessage {
  return { type: 'snapshot', serverTime, phase: 'intro', phaseRemaining: 10, players, items: [], logs: [], meteors: [] };
}

describe('SnapshotInterpolator', () => {
  it('스냅샷이 없으면 빈 화면을 돌려준다', () => {
    expect(new SnapshotInterpolator().getView(0)).toEqual({ players: [], items: [], logs: [], meteors: [] });
  });

  it('두 스냅샷 사이 위치를 보간한다', () => {
    const interpolator = new SnapshotInterpolator();
    interpolator.push(createSnapshot(1000, [createPlayerSnapshot('a', 0)]), 1000);
    interpolator.push(createSnapshot(1100, [createPlayerSnapshot('a', 100)]), 1100);
    expect(interpolator.getView(1150).players[0]?.x).toBeCloseTo(50);
  });

  it('새로 나타난 플레이어는 보간 없이 그대로 보여 준다', () => {
    const interpolator = new SnapshotInterpolator();
    interpolator.push(createSnapshot(1000, []), 1000);
    interpolator.push(createSnapshot(1100, [createPlayerSnapshot('new', 300)]), 1100);
    expect(interpolator.getView(1150).players[0]?.x).toBe(300);
  });

  it('보간 시점이 가장 오래된 스냅샷보다 이르면 가장 오래된 것을 쓴다', () => {
    const interpolator = new SnapshotInterpolator();
    interpolator.push(createSnapshot(1000, [createPlayerSnapshot('a', 10)]), 1000);
    expect(interpolator.getView(1000).players[0]?.x).toBe(10);
  });

  it('보간 시점이 최신보다 늦으면 최신 스냅샷을 쓴다', () => {
    const interpolator = new SnapshotInterpolator();
    interpolator.push(createSnapshot(1000, [createPlayerSnapshot('a', 10)]), 1000);
    interpolator.push(createSnapshot(1050, [createPlayerSnapshot('a', 20)]), 1050);
    expect(interpolator.getView(5000).players[0]?.x).toBe(20);
    expect(interpolator.getLatest()?.serverTime).toBe(1050);
  });
});

describe('client-state', () => {
  it('서버 메시지를 상태에 반영한다', () => {
    const state = createClientState();
    applyServerMessage(state, { type: 'welcome', playerId: 'me', resumeToken: 'secret', config: GAME_CONFIG }, 0);
    applyServerMessage(state, { type: 'roster', players: [{ id: 'me', nickname: '나', colorIndex: 0, isInWorld: false }] }, 0);
    applyServerMessage(state, { type: 'zones', zones: [] }, 5);
    applyServerMessage(state, { type: 'judged', answerIndex: 1, scorerIds: ['me'], scores: { me: 100 } }, 6);
    expect(state.playerId).toBe('me');
    expect(isSpectating(state)).toBe(true);
    expect(state.zonesReceivedAt).toBe(5);
    expect(state.judgement?.answerIndex).toBe(1);
    applyServerMessage(state, { type: 'question', question: null }, 7);
    expect(state.judgement).toBeNull();
    applyServerMessage(state, { type: 'finalResult', rankings: [] }, 8);
    applyServerMessage(state, { type: 'rejected', reason: 'roomFull' }, 9);
    applyServerMessage(state, { type: 'pong', clientTime: 1 }, 10);
    expect(state.finalReceivedAt).toBe(8);
    expect(state.rejectReason).toBe('roomFull');
  });

  it('남은 시간은 받은 뒤 흐른 시간과 편도 지연만큼 줄어든다', () => {
    const state = createClientState();
    applyServerMessage(state, createSnapshot(0, []), 1000);
    state.oneWayLatencySeconds = 0.05;
    expect(getPhaseRemaining(state, 3000)).toBeCloseTo(7.95);
    expect(getPhaseRemaining(state, 60_000)).toBe(0);
  });

  it('관리자 입장은 설정만 받고 플레이어 id는 없다', () => {
    const state = createClientState();
    applyServerMessage(state, { type: 'adminWelcome', config: GAME_CONFIG }, 0);
    expect(state.config).toBe(GAME_CONFIG);
    expect(state.playerId).toBeNull();
    expect(state.isAdminView).toBe(true);
  });

  it('입장 전에는 구경 중이 아니다', () => {
    expect(isSpectating(createClientState())).toBe(false);
  });
});
