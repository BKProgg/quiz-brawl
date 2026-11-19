import type { ItemSnapshot, LogSnapshot, MeteorSnapshot, PlayerSnapshot, ServerMessage } from '../game/protocol-types';

export type SnapshotMessage = Extract<ServerMessage, { type: 'snapshot' }>;

const INTERPOLATION_DELAY_MILLISECONDS = 100;
const BUFFER_SIZE = 30;
const OFFSET_SMOOTHING = 0.1;

interface BufferedSnapshot {
  serverTime: number;
  message: SnapshotMessage;
}

function interpolate(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio;
}

function interpolateEntities<Entity extends { id: string; x: number; y: number }>(older: Entity[], newer: Entity[], ratio: number): Entity[] {
  const olderById = new Map(older.map((entity) => [entity.id, entity]));
  return newer.map((entity) => {
    const previous = olderById.get(entity.id);
    return previous ? { ...entity, x: interpolate(previous.x, entity.x, ratio), y: interpolate(previous.y, entity.y, ratio) } : entity;
  });
}

// 메테오는 움직이지 않지만 낙하 진행도가 초당 20번만 오므로 진행도를 보간해야 떨어지는 모습이 끊기지 않는다. 경고에서 충돌로 넘어가는 순간은 보간하지 않는다.
function interpolateMeteors(older: MeteorSnapshot[], newer: MeteorSnapshot[], ratio: number): MeteorSnapshot[] {
  const olderById = new Map(older.map((meteor) => [meteor.id, meteor]));
  return newer.map((meteor) => {
    const previous = olderById.get(meteor.id);
    return previous?.state === meteor.state ? { ...meteor, progress: interpolate(previous.progress, meteor.progress, ratio) } : meteor;
  });
}

// 다른 플레이어는 약 100ms 전 상태를 두 스냅샷 사이에서 보간해 그린다.
// 서버 시각과의 차이는 평균으로 추정한다.
export class SnapshotInterpolator {
  private readonly buffer: BufferedSnapshot[] = [];
  private serverTimeOffset: number | null = null;

  push(message: SnapshotMessage, receivedAt: number): void {
    const sample = message.serverTime - receivedAt;
    this.serverTimeOffset = this.serverTimeOffset === null ? sample : this.serverTimeOffset + (sample - this.serverTimeOffset) * OFFSET_SMOOTHING;
    this.buffer.push({ serverTime: message.serverTime, message });
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  getLatest(): SnapshotMessage | null {
    return this.buffer.at(-1)?.message ?? null;
  }

  getView(now: number): { players: PlayerSnapshot[]; items: ItemSnapshot[]; logs: LogSnapshot[]; meteors: MeteorSnapshot[] } {
    const latest = this.buffer.at(-1);
    if (!latest || this.serverTimeOffset === null) {
      return { players: [], items: [], logs: [], meteors: [] };
    }
    const renderTime = now + this.serverTimeOffset - INTERPOLATION_DELAY_MILLISECONDS;
    const newerIndex = this.buffer.findIndex((snapshot) => snapshot.serverTime >= renderTime);
    if (newerIndex <= 0) {
      const snapshot = newerIndex === 0 ? (this.buffer[0] as BufferedSnapshot) : latest;
      return { players: snapshot.message.players, items: snapshot.message.items, logs: snapshot.message.logs, meteors: snapshot.message.meteors };
    }
    const older = this.buffer[newerIndex - 1] as BufferedSnapshot;
    const newer = this.buffer[newerIndex] as BufferedSnapshot;
    const span = newer.serverTime - older.serverTime;
    const ratio = span > 0 ? (renderTime - older.serverTime) / span : 1;
    return {
      players: interpolateEntities(older.message.players, newer.message.players, ratio),
      items: interpolateEntities(older.message.items, newer.message.items, ratio),
      logs: interpolateEntities(older.message.logs, newer.message.logs, ratio),
      meteors: interpolateMeteors(older.message.meteors, newer.message.meteors, ratio),
    };
  }
}
