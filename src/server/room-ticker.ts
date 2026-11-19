// 고정 간격 틱 루프. 매 틱 onTick을 부르고, 스냅샷 주기마다 시뮬레이션 시각(틱 수 × 틱 길이)과 함께 onSnapshot을 부른다.
// setInterval은 요청한 간격보다 조금씩 늦게 불리므로(33.3ms → 약 34.5ms), 벽시계로 지난 시간을 재서
// 밀린 만큼 틱을 더 돌린다. 그래야 "30초 카운트"가 실제 30초가 된다. 한 번에 너무 많이 밀리면 일부는 버린다.
const MAX_CATCH_UP_TICKS = 5;

export class RoomTicker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;
  private snapshotElapsed = 0;
  private lastTickedAt = 0;
  private accumulatedSeconds = 0;

  constructor(
    private readonly tickSeconds: number,
    private readonly snapshotIntervalSeconds: number,
    private readonly onTick: (deltaSeconds: number) => void,
    private readonly onSnapshot: (serverTime: number) => void,
    private readonly now: () => number = () => Date.now(),
  ) {}

  start(): void {
    if (this.timer === null) {
      this.lastTickedAt = this.now();
      this.accumulatedSeconds = 0;
      this.timer = setInterval(() => this.catchUp(), this.tickSeconds * 1000);
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private catchUp(): void {
    const current = this.now();
    this.accumulatedSeconds += (current - this.lastTickedAt) / 1000;
    this.lastTickedAt = current;
    let steps = 0;
    while (this.accumulatedSeconds >= this.tickSeconds && steps < MAX_CATCH_UP_TICKS) {
      this.accumulatedSeconds -= this.tickSeconds;
      steps += 1;
      this.tick();
    }
    if (this.accumulatedSeconds >= this.tickSeconds) {
      this.accumulatedSeconds = 0;
    }
  }

  private tick(): void {
    this.tickCount += 1;
    this.onTick(this.tickSeconds);
    this.snapshotElapsed += this.tickSeconds;
    if (this.snapshotElapsed >= this.snapshotIntervalSeconds) {
      this.snapshotElapsed -= this.snapshotIntervalSeconds;
      this.onSnapshot(this.tickCount * this.tickSeconds * 1000);
    }
  }
}
