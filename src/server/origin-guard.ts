// 다른 사이트에서 이 서버로 WebSocket을 여는 것(CSWSH)을 막는다.
// Origin이 없는 요청(브라우저가 아닌 클라이언트)은 그대로 허용한다.
export function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('Origin');
  if (origin === null) {
    return true;
  }
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}
