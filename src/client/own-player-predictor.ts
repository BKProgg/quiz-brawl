import type { GameConfig } from '../game/game-config';
import type { PlayerInput, Vector } from '../game/game-types';

import { readInputDirection } from '../game/movement-physics';
import { clampNumber, getDistance, normalizeVector } from '../game/vector-math';

const HISTORY_MILLISECONDS = 1000;
const SNAP_DISTANCE = 90;
const CORRECTION_RATE = 0.2;
const ACTION_PAUSE_MARGIN_MILLISECONDS = 120;

interface PositionSample {
  time: number;
  position: Vector;
}

// 내 캐릭터 이동은 키를 누르는 즉시 화면에 반영하고(예측), 서버 위치가 오면 조금씩 맞춘다(보정).
// - 서버 위치는 왕복 지연만큼 과거의 내 위치와 비교해야 하므로 예측 위치 기록을 남긴다.
// - 서버에서 자유 상태가 아니면(맞음·잡힘·공중 등) 예측을 끄고, 다른 캐릭터와 같은 보간 위치로 그린다.
export class OwnPlayerPredictor {
  private position: Vector | null = null;
  private history: PositionSample[] = [];
  private pausedUntil = 0;

  // Z/X를 누르면 서버는 그 자리에서 멈추므로, 서버 상태가 도착할 때까지 예측 이동을 멈춘다.
  pauseForAction(now: number, roundTripMilliseconds: number, isBlockPressed: boolean): void {
    if (this.position !== null && !isBlockPressed) {
      this.pausedUntil = now + roundTripMilliseconds + ACTION_PAUSE_MARGIN_MILLISECONDS;
    }
  }

  advance(now: number, deltaSeconds: number, input: PlayerInput, obstacles: Vector[], config: GameConfig): void {
    if (this.position === null || now < this.pausedUntil) {
      return;
    }
    const direction = readInputDirection(input);
    const speed = config.player.moveSpeed * (input.isBlockPressed ? config.player.blockMoveSpeedRatio : 1);
    const moved = { x: this.position.x + direction.x * speed * deltaSeconds, y: this.position.y + direction.y * speed * deltaSeconds };
    this.position = this.clampToArena(this.separateFromObstacles(moved, obstacles, config), config);
    this.history.push({ time: now, position: { ...this.position } });
    this.history = this.history.filter((sample) => now - sample.time <= HISTORY_MILLISECONDS);
  }

  reconcile(serverPosition: Vector, isServerFree: boolean, roundTripMilliseconds: number, now: number, displayedPosition: Vector): void {
    if (!isServerFree) {
      this.position = null;
      this.history = [];
      this.pausedUntil = 0;
      return;
    }
    if (this.position === null) {
      this.resetTo(displayedPosition);
      return;
    }
    const past = this.findSampleAt(now - roundTripMilliseconds)?.position ?? this.position;
    const error = { x: serverPosition.x - past.x, y: serverPosition.y - past.y };
    if (Math.hypot(error.x, error.y) > SNAP_DISTANCE) {
      this.resetTo(serverPosition);
      return;
    }
    const correction = { x: error.x * CORRECTION_RATE, y: error.y * CORRECTION_RATE };
    this.position = { x: this.position.x + correction.x, y: this.position.y + correction.y };
    this.history.forEach((sample) => {
      sample.position = { x: sample.position.x + correction.x, y: sample.position.y + correction.y };
    });
  }

  getPosition(): Vector | null {
    return this.position;
  }

  // 다른 캐릭터와 겹치지 않게 밀어낸다. 서버는 서로 반씩 밀지만, 화면에서 겹쳐 보이지 않도록 내 쪽을 모두 뺀다.
  private separateFromObstacles(position: Vector, obstacles: Vector[], config: GameConfig): Vector {
    const minimumDistance = config.player.radius * 2;
    return obstacles.reduce((current, obstacle) => {
      if (getDistance(current, obstacle) >= minimumDistance) {
        return current;
      }
      const normal = normalizeVector({ x: current.x - obstacle.x, y: current.y - obstacle.y }, { x: 1, y: 0 });
      return { x: obstacle.x + normal.x * minimumDistance, y: obstacle.y + normal.y * minimumDistance };
    }, position);
  }

  private clampToArena(position: Vector, config: GameConfig): Vector {
    const { left, right, top, bottom } = config.arena;
    return { x: clampNumber(position.x, left, right), y: clampNumber(position.y, top, bottom) };
  }

  private resetTo(position: Vector): void {
    this.position = { x: position.x, y: position.y };
    this.history = [];
  }

  private findSampleAt(time: number): PositionSample | undefined {
    return this.history.reduce<PositionSample | undefined>((closest, sample) => {
      if (!closest) {
        return sample;
      }
      return Math.abs(sample.time - time) < Math.abs(closest.time - time) ? sample : closest;
    }, undefined);
  }
}
