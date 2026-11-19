import type { PlayerState } from '../game/game-types';
import type { PlayerSnapshot } from '../game/protocol-types';

// 든 사람의 이름표(머리 위)가 가려지지 않을 만큼 높인다.
const LIFTED_HEIGHT = 116;
// 들기 시간(1.5초)의 이 비율 동안 머리 위까지 올라간다.
const RISE_PROGRESS = 0.1;
const DROP_MILLISECONDS = 150;
const THROWN_ARC_HEIGHT = 40;
const LAUNCH_ARC_HEIGHT = 70;
const LAUNCH_BASE_HEIGHT = 10;

// 캐릭터를 땅에서 얼마나 띄워 그릴지 정한다. 서버의 위치에는 높이가 없는 화면 전용 값이다.
// 들렸다가 풀리거나 던져질 때 높이가 뚝 끊기지 않도록 직전 상태를 기억한다.
export class CharacterLiftAnimator {
  private readonly previousStates = new Map<string, PlayerState>();
  private readonly thrownPlayerIds = new Set<string>();
  private readonly droppedAt = new Map<string, number>();

  // 끊겼다 다시 붙으면 끊기기 전 상태와 비교하지 않게 기억을 지운다.
  reset(): void {
    this.previousStates.clear();
    this.thrownPlayerIds.clear();
    this.droppedAt.clear();
  }

  computeLift(player: PlayerSnapshot, now: number): number {
    this.observeState(player, now);
    if (player.state === 'grabbed') {
      return LIFTED_HEIGHT * Math.min(1, player.progress / RISE_PROGRESS);
    }
    if (player.state === 'airborne') {
      return this.computeAirborneLift(player);
    }
    return this.computeDropLift(player.id, now);
  }

  private observeState(player: PlayerSnapshot, now: number): void {
    const previous = this.previousStates.get(player.id);
    this.previousStates.set(player.id, player.state);
    if (player.state !== 'airborne') {
      this.thrownPlayerIds.delete(player.id);
    }
    if (previous !== 'grabbed') {
      return;
    }
    if (player.state === 'airborne') {
      this.thrownPlayerIds.add(player.id);
    } else if (player.state !== 'grabbed') {
      this.droppedAt.set(player.id, now);
    }
  }

  // 던져진 사람은 머리 위 높이에서 시작해 내려오고, 맞아서 날아가는 사람은 바닥 근처에서 포물선을 그린다.
  private computeAirborneLift(player: PlayerSnapshot): number {
    const arc = Math.sin(player.progress * Math.PI);
    if (this.thrownPlayerIds.has(player.id)) {
      return LIFTED_HEIGHT * (1 - player.progress) + arc * THROWN_ARC_HEIGHT;
    }
    return arc * LAUNCH_ARC_HEIGHT + LAUNCH_BASE_HEIGHT;
  }

  private computeDropLift(playerId: string, now: number): number {
    const droppedAt = this.droppedAt.get(playerId);
    if (droppedAt === undefined) {
      return 0;
    }
    const remainingRatio = 1 - (now - droppedAt) / DROP_MILLISECONDS;
    if (remainingRatio <= 0) {
      this.droppedAt.delete(playerId);
      return 0;
    }
    return LIFTED_HEIGHT * remainingRatio;
  }
}
