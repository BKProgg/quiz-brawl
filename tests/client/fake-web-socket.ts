type Listener = (event: unknown) => void;

// 브라우저 WebSocket 대역. open/receive/emit로 서버 쪽 사건을 흉내 낸다.
export class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  closeCount = 0;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closeCount += 1;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open', {});
  }

  receive(message: unknown): void {
    this.emit('message', { data: JSON.stringify(message) });
  }

  emit(type: string, event: unknown): void {
    (this.listeners.get(type) ?? []).forEach((listener) => listener(event));
  }

  sentTypes(): string[] {
    return this.sent.map((data) => (JSON.parse(data) as { type: string }).type);
  }
}
