export interface SocketHandlers {
  onMessage: (data: unknown) => void;
  onClose: () => void;
}

const UPGRADE_REQUIRED_STATUS = 426;

// HTTP 요청을 WebSocket으로 올린다. 서버 쪽 소켓은 열어서 돌려주고, 클라이언트 쪽 소켓은 101 응답에 실어 보낸다.
// WebSocket 요청이 아니면 null을 돌려준다.
export function upgradeToWebSocket(request: Request, handlers: SocketHandlers): { socket: WebSocket; response: Response } | null {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return null;
  }
  const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
  server.accept();
  server.addEventListener('message', (event) => handlers.onMessage(event.data));
  server.addEventListener('close', () => handlers.onClose());
  server.addEventListener('error', () => handlers.onClose());
  return { socket: server, response: new Response(null, { status: 101, webSocket: client }) };
}

export function buildUpgradeRequiredResponse(): Response {
  return new Response('WebSocket 연결만 지원합니다.', { status: UPGRADE_REQUIRED_STATUS });
}
