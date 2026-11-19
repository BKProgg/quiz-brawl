import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoomTicker } from '../../src/server/room-ticker';

describe('RoomTicker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('틱마다 onTick을 부르고, 스냅샷 주기마다 시뮬레이션 시각을 넘긴다', () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const onSnapshot = vi.fn();
    const ticker = new RoomTicker(0.1, 0.2, onTick, onSnapshot);
    ticker.start();
    ticker.start();
    vi.advanceTimersByTime(400);
    expect(onTick).toHaveBeenCalledTimes(4);
    expect(onSnapshot.mock.calls.map(([serverTime]) => Math.round(serverTime))).toEqual([200, 400]);
    ticker.stop();
    ticker.stop();
    vi.advanceTimersByTime(400);
    expect(onTick).toHaveBeenCalledTimes(4);
  });
});
