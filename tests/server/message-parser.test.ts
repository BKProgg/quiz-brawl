import { describe, expect, it } from 'vitest';

import { GAME_CONFIG } from '../../src/game/game-config';
import { parseClientMessage, sanitizeNickname } from '../../src/server/message-parser';

const VALID_INPUT = {
  type: 'input',
  isUpPressed: false,
  isDownPressed: true,
  isLeftPressed: false,
  isRightPressed: true,
  isBlockPressed: false,
  punchCount: 3,
  kickCount: 0,
};

function parse(value: unknown) {
  return parseClientMessage(typeof value === 'string' ? value : JSON.stringify(value), GAME_CONFIG);
}

describe('parseClientMessage', () => {
  it.each([
    ['문자열이 아닌 값', 123],
    ['너무 긴 메시지', 'x'.repeat(3000)],
    ['JSON이 아닌 문자열', '{broken'],
    ['객체가 아닌 JSON', '[1, 2]'],
    ['알 수 없는 타입', { type: 'hack' }],
  ])('%s은 무시한다', (_, raw) => {
    expect(parseClientMessage(raw, GAME_CONFIG)).toBeNull();
  });

  it('입장 메시지를 읽는다', () => {
    expect(parse({ type: 'join', nickname: '김버그', colorIndex: 3 })).toEqual({ type: 'join', nickname: '김버그', colorIndex: 3 });
  });

  it.each([-1, 12, 1.5, '1'])('캐릭터 색 번호가 범위 밖이거나 정수가 아니면(%s) 무시한다', (colorIndex) => {
    expect(parse({ type: 'join', nickname: '김', colorIndex })).toBeNull();
  });

  it.each([undefined, 7, 'x'.repeat(65)])('닉네임이 문자열이 아니거나 너무 길면(%s) 무시한다', (nickname) => {
    expect(parse({ type: 'join', nickname, colorIndex: 1 })).toBeNull();
  });

  it('복귀 메시지는 id와 토큰이 모두 있어야 읽는다', () => {
    expect(parse({ type: 'resume', playerId: 'p1', resumeToken: 't1' })).toEqual({ type: 'resume', playerId: 'p1', resumeToken: 't1' });
    expect(parse({ type: 'resume', playerId: 'p1' })).toBeNull();
    expect(parse({ type: 'resume', playerId: '', resumeToken: 't1' })).toBeNull();
    expect(parse({ type: 'resume', playerId: 'p1', resumeToken: 'x'.repeat(65) })).toBeNull();
  });

  it('관리자 입장 메시지를 읽는다', () => {
    expect(parse({ type: 'adminJoin' })).toEqual({ type: 'adminJoin' });
  });

  it('입력 메시지에서 필요한 필드만 남긴다', () => {
    expect(parse({ ...VALID_INPUT, extra: 'ignored' })).toEqual(VALID_INPUT);
  });

  it('입력 메시지의 버튼 값이 불리언이 아니면 무시한다', () => {
    expect(parse({ ...VALID_INPUT, isUpPressed: 'yes' })).toBeNull();
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 2])('누름 횟수가 안전한 0 이상 정수가 아니면(%s) 무시한다', (punchCount) => {
    expect(parse({ ...VALID_INPUT, punchCount })).toBeNull();
  });

  it('시작 메시지와 핑 메시지를 읽는다', () => {
    expect(parse({ type: 'start' })).toEqual({ type: 'start' });
    expect(parse({ type: 'ping', clientTime: 12.5 })).toEqual({ type: 'ping', clientTime: 12.5 });
  });

  it('핑 시각이 숫자가 아니면 무시한다', () => {
    expect(parse({ type: 'ping', clientTime: 'now' })).toBeNull();
  });
});

describe('sanitizeNickname', () => {
  it('앞뒤 공백을 지우고 한글 기준 최대 글자 수로 자른다', () => {
    expect(sanitizeNickname('  김버그  ', GAME_CONFIG)).toBe('김버그');
    expect(sanitizeNickname('일이삼사오육칠', GAME_CONFIG)).toBe('일이삼사오');
  });

  it('제어 문자와 보이지 않는 서식 문자를 지운다', () => {
    expect(sanitizeNickname('김\u200b버\u0007그', GAME_CONFIG)).toBe('김버그');
  });

  it('남는 글자가 없으면 null', () => {
    expect(sanitizeNickname('   ', GAME_CONFIG)).toBeNull();
    expect(sanitizeNickname('\u200b', GAME_CONFIG)).toBeNull();
  });
});
