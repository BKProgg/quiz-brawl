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

const { timeline } = GAME_CONFIG;

describe('MatchController — 입장', () => {
  it('이미 누가 쓰는 색은 고를 수 없고, 나가면 다시 고를 수 있다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 3);
    expect(controller.isColorAvailable(3)).toBe(false);
    expect(controller.isColorAvailable(4)).toBe(true);
    controller.removePlayer('a', 0);
    expect(controller.isColorAvailable(3)).toBe(true);
  });

  it('진행 중에 대기하는 사람의 색도 사용 중으로 본다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.startMatch();
    controller.addPlayer('late', '늦', 5);
    expect(controller.isColorAvailable(5)).toBe(false);
  });

  it('최대 인원이 차면 가득 찬 상태가 된다', () => {
    const controller = createController();
    for (let index = 0; index < GAME_CONFIG.maxPlayers; index += 1) {
      controller.addPlayer(`p${index}`, `p${index}`, index);
    }
    expect(controller.isFull()).toBe(true);
  });

  it('경기장에 플레이어가 없으면 시작하지 않는다', () => {
    expect(createController().startMatch()).toEqual([]);
  });

  it('문제가 하나도 없으면 시작하지 않는다', () => {
    const controller = createController([]);
    controller.addPlayer('a', '가', 0);
    expect(controller.startMatch()).toEqual([]);
    expect(getSnapshotPhase(controller)).toBe('lobby');
  });

  it('시작하면 점수만 초기화하고 위치는 그대로 둔다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    const before = getSnapshotPlayer(controller, 'a');
    controller.startMatch();
    const after = getSnapshotPlayer(controller, 'a');
    expect(after?.x).toBe(before?.x);
    expect(after?.score).toBe(0);
  });

  it('대기실에도 처음부터 아이템이 깔려 있다', () => {
    const snapshot = createController().buildSnapshot(0);
    expect(snapshot.type === 'snapshot' && snapshot.items.length).toBe(GAME_CONFIG.item.initialCount);
  });

  it('첫 입력의 버튼 횟수는 기준값으로만 쓰고, 그 뒤에 누른 것부터 처리한다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.setInput('a', { ...createEmptyInput(), punchCount: 5 });
    controller.tick(TICK_SECONDS, 0);
    expect(getSnapshotPlayer(controller, 'a')?.state).toBe('free');
    controller.setInput('a', { ...createEmptyInput(), punchCount: 6 });
    controller.tick(TICK_SECONDS, 0);
    expect(getSnapshotPlayer(controller, 'a')?.state).toBe('punching');
  });

  it('키를 떼면 멈추고, 버튼 횟수는 남아 다음 입력에서 공격이 저절로 나가지 않는다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.setInput('a', { ...createEmptyInput(), isRightPressed: true, isBlockPressed: true, punchCount: 3 });
    controller.tick(TICK_SECONDS, 0);
    controller.releaseKeys('a');
    const before = getSnapshotPlayer(controller, 'a');
    controller.tick(TICK_SECONDS, 0);
    const after = getSnapshotPlayer(controller, 'a');
    expect(after?.x).toBe(before?.x);
    expect(after?.isBlocking).toBe(false);
    expect(after?.state).toBe('free');
    controller.setInput('a', { ...createEmptyInput(), punchCount: 3 });
    controller.tick(TICK_SECONDS, 0);
    expect(getSnapshotPlayer(controller, 'a')?.state).toBe('free');
  });

  it('없는 플레이어의 입력·키 떼기·퇴장은 무시한다', () => {
    const controller = createController();
    controller.setInput('ghost', createEmptyInput());
    controller.releaseKeys('ghost');
    controller.removePlayer('ghost', 0);
    expect(controller.hasPlayers()).toBe(false);
  });
});

describe('MatchController — 한 판 진행', () => {
  it('정답 구역 안에 있으면 득점하고, 최종 순위 화면은 시간이 지나도 유지된다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    expect(controller.startMatch()).toHaveLength(2);
    expect(controller.startMatch()).toEqual([]);
    const messages = playFirstQuestionCorrectly(controller, 'a');
    expect(findMessage(messages, 'question')?.question).not.toHaveProperty('answerIndex');
    expect(findMessage(messages, 'judged')?.scorerIds).toEqual(['a']);
    const finalMessages = runUntil(controller, 'finalResult', timeline.finalRevealDelaySeconds + 1);
    expect(findMessage(finalMessages, 'finalResult')?.rankings[0]?.score).toBe(GAME_CONFIG.scoring.pointsPerCorrect);
    runSeconds(controller, 30);
    expect(getSnapshotPhase(controller)).toBe('final');
    expect(controller.buildSyncMessages().map((message) => message.type)).toContain('finalResult');
  });

  it('진행 중에 들어온 사람은 경기장에 들어가지 않고 대기한다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.startMatch();
    controller.addPlayer('late', '늦', 1);
    expect(findRosterPlayer(controller, 'late')?.isInWorld).toBe(false);
    expect(controller.buildSyncMessages().map((message) => message.type)).toEqual(['question', 'zones']);
    runSeconds(controller, timeline.introBrawlSeconds + timeline.answerCountdownSeconds + timeline.finalRevealDelaySeconds);
    expect(controller.buildSyncMessages().map((message) => message.type)).toContain('finalResult');
    expect(getSnapshotPlayer(controller, 'late')).toBeUndefined();
  });

  it('게임 중 경기장이 비어 대기실로 돌아가면 대기하던 사람이 경기장에 들어간다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.startMatch();
    controller.addPlayer('late', '늦', 1);
    controller.removePlayer('a', 0);
    runSeconds(controller, 1, GAME_CONFIG.network.reconnectGraceSeconds * 1000);
    expect(getSnapshotPhase(controller)).toBe('lobby');
    expect(getSnapshotPlayer(controller, 'late')).toBeDefined();
  });

  it('판정 직후에 들어온 사람에게는 판정 결과도 맞춰 준다', () => {
    const controller = createController();
    controller.addPlayer('a', '가', 0);
    controller.startMatch();
    runSeconds(controller, timeline.introBrawlSeconds + timeline.answerCountdownSeconds);
    expect(controller.buildSyncMessages().map((message) => message.type)).toEqual(['question', 'zones', 'judged']);
  });
});
