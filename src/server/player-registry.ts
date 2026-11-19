import type { GameConfig } from '../game/game-config';
import type { PlayerEntity, WorldState } from '../game/game-types';
import type { RosterPlayer } from '../game/protocol-types';

import { createEmptyInput, createPlayer } from '../game/player-factory';
import { interruptPlayer, setPlayerFree } from '../game/player-interrupt';

interface SuspendedPlayer {
  player: PlayerEntity;
  suspendedAt: number;
}

// 방의 참가자 명단. 경기장(world)·다음 판 대기(waiting)·재접속 유예(suspended) 세 곳 중 한 곳에 있다.
// 유예 중인 사람은 색을 계속 차지하고 점수를 유지하며, 같은 id로 돌아오면 경기장에 바로 복귀한다.
export class PlayerRegistry {
  private readonly waitingPlayers = new Map<string, PlayerEntity>();
  private readonly suspendedPlayers = new Map<string, SuspendedPlayer>();
  private readonly joinOrder: string[] = [];

  constructor(private readonly world: WorldState, private readonly config: GameConfig) {}

  isFull(): boolean {
    return this.joinOrder.length >= this.config.maxPlayers;
  }

  hasAnyone(): boolean {
    return this.joinOrder.length > 0;
  }

  hasSuspended(): boolean {
    return this.suspendedPlayers.size > 0;
  }

  isColorAvailable(colorIndex: number): boolean {
    return !this.joinOrder.some((playerId) => this.findPlayer(playerId)?.colorIndex === colorIndex);
  }

  findPlayer(playerId: string): PlayerEntity | undefined {
    return this.world.players.get(playerId) ?? this.waitingPlayers.get(playerId) ?? this.suspendedPlayers.get(playerId)?.player;
  }

  add(playerId: string, nickname: string, colorIndex: number, position: PlayerEntity['position'], isMatchRunning: boolean): PlayerEntity {
    const player = createPlayer(playerId, nickname, colorIndex, position);
    (isMatchRunning ? this.waitingPlayers : this.world.players).set(playerId, player);
    this.joinOrder.push(playerId);
    return player;
  }

  // 게임 중 끊기면 바로 지우지 않고 유예 목록에 둔다. 대기실이면 그냥 나간 것으로 본다.
  // 끊기기 직전에 누르고 있던 키는 버려서, 복귀 직후 혼자 움직이지 않게 한다.
  suspend(playerId: string, now: number, isMatchRunning: boolean): void {
    const player = this.world.players.get(playerId);
    if (player && isMatchRunning) {
      interruptPlayer(player, this.world, this.config);
      // 들고 있던 사람을 놓았으므로, 돌아왔을 때 빈손으로 드는 자세가 남지 않게 한다.
      if (player.state === 'lifting') {
        setPlayerFree(player);
      }
      player.input = createEmptyInput();
      syncHandledInputs(player);
      this.world.players.delete(playerId);
      this.suspendedPlayers.set(playerId, { player, suspendedAt: now });
      return;
    }
    this.remove(playerId);
  }

  // 유예 중이면 경기장으로 되돌린다. 아직 끊긴 것으로 처리되지 않은 사람(죽은 연결이 남아 있는 경우)은 그 자리를 그대로 돌려준다.
  resume(playerId: string): PlayerEntity | null {
    const suspended = this.suspendedPlayers.get(playerId);
    if (!suspended) {
      return this.findPlayer(playerId) ?? null;
    }
    this.suspendedPlayers.delete(playerId);
    this.world.players.set(playerId, suspended.player);
    return suspended.player;
  }

  // 순위에 들어가는 사람: 경기장에 있는 사람과 잠깐 끊긴 사람. 다음 판 대기자는 제외한다.
  listCompetitors(): PlayerEntity[] {
    return [...this.world.players.values(), ...[...this.suspendedPlayers.values()].map((entry) => entry.player)];
  }

  resetScores(): void {
    this.joinOrder.forEach((playerId) => {
      const player = this.findPlayer(playerId);
      if (player) {
        player.score = 0;
      }
    });
  }

  // 유예 시간이 지난 사람을 완전히 내보낸다. 내보낸 사람이 있으면 true.
  expireSuspended(now: number, graceSeconds: number): boolean {
    const expiredIds = [...this.suspendedPlayers].filter(([, entry]) => now - entry.suspendedAt >= graceSeconds * 1000).map(([id]) => id);
    expiredIds.forEach((playerId) => this.remove(playerId));
    return expiredIds.length > 0;
  }

  // 완전히 나간 사람을 들고 있던 사람은 빈손으로 남지 않게 바로 풀어 준다. (유예 중에는 돌아올 수 있으므로 계속 든 채로 둔다.)
  private freeLiftersOf(playerId: string): void {
    this.world.players.forEach((player) => {
      if (player.grabbedTargetId === playerId) {
        player.grabbedTargetId = null;
        setPlayerFree(player);
      }
    });
  }

  remove(playerId: string): void {
    const player = this.world.players.get(playerId);
    if (player) {
      interruptPlayer(player, this.world, this.config);
      this.world.players.delete(playerId);
    }
    this.freeLiftersOf(playerId);
    this.waitingPlayers.delete(playerId);
    this.suspendedPlayers.delete(playerId);
    const index = this.joinOrder.indexOf(playerId);
    if (index >= 0) {
      this.joinOrder.splice(index, 1);
    }
  }

  // 대기하던 사람을 경기장에 넣는다. 그동안 눌렀던 버튼이 한꺼번에 처리되지 않게 처리 횟수를 맞춘다.
  promoteWaiting(): void {
    this.waitingPlayers.forEach((player, playerId) => {
      syncHandledInputs(player);
      this.world.players.set(playerId, player);
    });
    this.waitingPlayers.clear();
  }

  buildRoster(): RosterPlayer[] {
    return this.joinOrder.map((playerId) => ({
      id: playerId,
      nickname: this.findPlayer(playerId)?.nickname ?? '',
      colorIndex: this.findPlayer(playerId)?.colorIndex ?? 0,
      isInWorld: this.world.players.has(playerId),
    }));
  }
}

export function syncHandledInputs(player: PlayerEntity): void {
  player.handledPunchCount = player.input.punchCount;
  player.handledKickCount = player.input.kickCount;
}
