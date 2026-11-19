import { describe, expect, it } from 'vitest';

import { isSameOrigin } from '../../src/server/origin-guard';

const SERVER_URL = new URL('https://quiz.example.workers.dev/ws');

function createRequest(origin?: string): Request {
  return new Request(SERVER_URL, { headers: origin === undefined ? {} : { Origin: origin } });
}

describe('isSameOrigin', () => {
  it('같은 호스트에서 연 연결은 허용한다', () => {
    expect(isSameOrigin(createRequest('https://quiz.example.workers.dev'), SERVER_URL)).toBe(true);
  });

  it('다른 사이트에서 연 연결은 막는다', () => {
    expect(isSameOrigin(createRequest('https://evil.example.com'), SERVER_URL)).toBe(false);
  });

  it('Origin 값이 URL 형식이 아니면 막는다', () => {
    expect(isSameOrigin(createRequest('null'), SERVER_URL)).toBe(false);
  });

  it('Origin이 없는 요청은 허용한다', () => {
    expect(isSameOrigin(createRequest(), SERVER_URL)).toBe(true);
  });
});
