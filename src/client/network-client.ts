import type { ClientMessage, ServerMessage } from '../game/protocol-types';

const PING_INTERVAL_MILLISECONDS = 2000;
const WATCH_INTERVAL_MILLISECONDS = 1000;
// 서버에서 이 시간 동안 아무 메시지(핑 응답 포함)도 오지 않으면 죽은 연결로 보고 버린다. 브라우저의 close 알림은 한참 뒤에 올 수 있어서다.
// 핑은 2~3초 간격으로 나가므로, 응답이 두 번쯤 밀려도 끊지 않을 만큼 여유를 둔다.
const SILENCE_TIMEOUT_MILLISECONDS = 8000;
const ROUND_TRIP_SMOOTHING = 0.2;
// 응답 없는 네트워크에서는 브라우저가 연결 실패를 1분 넘게 알려 주지 않는다. 이 시간 안에 열리지 않으면 그 시도를 버려 다음 재시도가 나가게 한다.
const CONNECT_TIMEOUT_MILLISECONDS = 4000;

export class NetworkClient {
  private socket: WebSocket | null = null;
  private onClose: ((reason: string) => void) | null = null;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private roundTripMilliseconds = 80;
  private lastMessageAt = 0;
  private lastPingAt = 0;
  private lastWatchAt = 0;

  // onClose에는 서버가 끊으며 보낸 사유가 전달된다(우리가 버린 연결이면 빈 문자열).
  // 열리기 전에 실패한 연결은 거부(reject)로만 알리고 onClose는 부르지 않는다.
  connect(onMessage: (message: ServerMessage) => void, onClose: (reason: string) => void): Promise<void> {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${location.host}/ws`);
    let hasOpened = false;
    this.socket = socket;
    this.onClose = onClose;
    // 우리가 먼저 버린 연결(dropConnection)이나 더 새 소켓에 밀린 옛 소켓의 늦은 이벤트는 무시한다.
    socket.addEventListener('message', (event) => {
      if (this.socket === socket) {
        this.handleMessage(event, onMessage);
      }
    });
    socket.addEventListener('close', (event) => {
      if (this.socket === socket && hasOpened) {
        this.finishConnection(event.reason);
      }
    });
    return new Promise((resolve, reject) => {
      const fail = (): void => {
        clearTimeout(timeout);
        reject(new Error('서버에 연결하지 못했습니다.'));
      };
      const timeout = setTimeout(() => {
        socket.close();
        fail();
      }, CONNECT_TIMEOUT_MILLISECONDS);
      socket.addEventListener('open', () => {
        clearTimeout(timeout);
        // 재접속 시도가 겹쳐 더 새 소켓이 생긴 뒤 늦게 열린 소켓은 쓰지 않고 닫는다.
        if (this.socket !== socket) {
          socket.close();
          return;
        }
        hasOpened = true;
        this.startWatching();
        resolve();
      }, { once: true });
      socket.addEventListener('error', fail, { once: true });
    });
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  getRoundTripMilliseconds(): number {
    return this.roundTripMilliseconds;
  }

  // 서버 소식이 끊긴(죽은) 연결을 기다리지 않고 바로 버린다.
  dropConnection(): void {
    const socket = this.socket;
    if (socket === null) {
      return;
    }
    try {
      socket.close();
    } catch {
      // 이미 닫힌 소켓이면 무시
    }
    this.finishConnection('');
  }

  private finishConnection(reason: string): void {
    this.socket = null;
    this.stopWatching();
    const onClose = this.onClose;
    this.onClose = null;
    onClose?.(reason);
  }

  // 핑은 타이머로도 보내지만 받은 메시지에 맞춰서도 보낸다. 숨긴 탭은 브라우저가 타이머를 1분에 한 번까지 늦추지만 메시지 수신은 늦추지 않으므로,
  // 게임 중인 탭은 숨겨져 있어도 서버에 살아 있다고 계속 알릴 수 있다.
  private handleMessage(event: MessageEvent, onMessage: (message: ServerMessage) => void): void {
    const now = performance.now();
    this.lastMessageAt = now;
    this.sendPingIfDue(now);
    const message = JSON.parse(String(event.data)) as ServerMessage;
    if (message.type === 'pong') {
      const sample = now - message.clientTime;
      this.roundTripMilliseconds += (sample - this.roundTripMilliseconds) * ROUND_TRIP_SMOOTHING;
      return;
    }
    onMessage(message);
  }

  private sendPingIfDue(now: number): void {
    if (now - this.lastPingAt >= PING_INTERVAL_MILLISECONDS) {
      this.lastPingAt = now;
      this.send({ type: 'ping', clientTime: now });
    }
  }

  // 1초마다 밀린 핑을 보내고, 서버 소식이 끊겼으면 연결을 버린다.
  // 이 점검 자체가 늦게 돌았다면(탭이 숨겨졌거나 화면이 한동안 멈췄던 경우) 그동안 못 받은 것을 끊김으로 보지 않는다.
  private watch(): void {
    const now = performance.now();
    const isWatchDelayed = now - this.lastWatchAt > SILENCE_TIMEOUT_MILLISECONDS;
    this.lastWatchAt = now;
    this.sendPingIfDue(now);
    if (isWatchDelayed) {
      this.lastMessageAt = now;
      return;
    }
    if (now - this.lastMessageAt > SILENCE_TIMEOUT_MILLISECONDS) {
      this.dropConnection();
    }
  }

  // 소켓이 열릴 때마다 감시를 새로 시작한다. 이전 소켓의 감시는 finishConnection에서 이미 멈췄으므로 겹치지 않는다.
  private startWatching(): void {
    this.stopWatching();
    const now = performance.now();
    this.lastMessageAt = now;
    this.lastWatchAt = now;
    this.lastPingAt = 0;
    this.watchTimer = setInterval(() => this.watch(), WATCH_INTERVAL_MILLISECONDS);
  }

  private stopWatching(): void {
    if (this.watchTimer !== null) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }
}
