import type { GameConfig } from '../game/game-config';
import type { ClientMessage, InputMessage, JoinMessage, ResumeMessage } from '../game/protocol-types';

import { isValidColorIndex } from '../game/character-palette';

const MAX_MESSAGE_LENGTH = 2048;
const MAX_ID_LENGTH = 64;
// 제어 문자(Cc)와 보이지 않는 서식 문자(Cf: 폭 없는 공백, 방향 바꾸기 등)
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;
const INPUT_BOOLEAN_KEYS = ['isUpPressed', 'isDownPressed', 'isLeftPressed', 'isRightPressed', 'isBlockPressed'] as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeCounter(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

// 클라이언트가 보낸 문자열을 검증된 메시지로 바꾼다. 형식이 틀리면 null을 돌려주고 무시한다.
export function parseClientMessage(raw: unknown, config: GameConfig): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_LENGTH) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) {
    return null;
  }
  switch (data.type) {
    case 'join':
      return parseJoinMessage(data);
    case 'adminJoin':
      return { type: 'adminJoin' };
    case 'resume':
      return parseResumeMessage(data);
    case 'input':
      return parseInputMessage(data);
    case 'start':
      return { type: 'start' };
    case 'newGame':
      return { type: 'newGame' };
    case 'ping':
      return typeof data.clientTime === 'number' && Number.isFinite(data.clientTime) ? { type: 'ping', clientTime: data.clientTime } : null;
    default:
      return null;
  }
}

function isIdString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function parseResumeMessage(data: UnknownRecord): ResumeMessage | null {
  if (!isIdString(data.playerId) || !isIdString(data.resumeToken)) {
    return null;
  }
  return { type: 'resume', playerId: data.playerId, resumeToken: data.resumeToken };
}

function parseJoinMessage(data: UnknownRecord): JoinMessage | null {
  if (typeof data.colorIndex !== 'number' || !isValidColorIndex(data.colorIndex)) {
    return null;
  }
  if (typeof data.nickname !== 'string' || data.nickname.length > MAX_ID_LENGTH) {
    return null;
  }
  return { type: 'join', nickname: data.nickname, colorIndex: data.colorIndex };
}

// 제어·서식 문자를 지우고 앞뒤 공백을 정리한 뒤 최대 글자 수(한글 기준)로 자른다. 남는 글자가 없으면 null.
export function sanitizeNickname(nickname: string, config: GameConfig): string | null {
  const cleaned = nickname.replace(INVISIBLE_CHARACTERS, '').trim();
  if (cleaned.length === 0) {
    return null;
  }
  return Array.from(cleaned).slice(0, config.network.nicknameMaxLength).join('').trim() || null;
}

function parseInputMessage(data: UnknownRecord): InputMessage | null {
  if (!INPUT_BOOLEAN_KEYS.every((key) => typeof data[key] === 'boolean')) {
    return null;
  }
  if (!isSafeCounter(data.punchCount) || !isSafeCounter(data.kickCount)) {
    return null;
  }
  return {
    type: 'input',
    isUpPressed: data.isUpPressed as boolean,
    isDownPressed: data.isDownPressed as boolean,
    isLeftPressed: data.isLeftPressed as boolean,
    isRightPressed: data.isRightPressed as boolean,
    isBlockPressed: data.isBlockPressed as boolean,
    punchCount: data.punchCount,
    kickCount: data.kickCount,
  };
}
