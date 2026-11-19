import type { GameConfig } from '../game/game-config';
import type { PlayerEntity, PlayerInput, QuizQuestion, RandomSource, RankingEntry } from '../game/game-types';
import type { MatchEvent } from '../game/phase-scheduler';
import type { ServerMessage } from '../game/protocol-types';
import type { JudgedMessage } from './match-messages';

import { resetItems } from '../game/item-system';
import { spawnMeteor } from '../game/meteor-system';
import { advanceMatch, createLobbyMatch, returnToLobby, startMatch } from '../game/phase-scheduler';
import { createEmptyInput, pickRandomArenaPosition } from '../game/player-factory';
import { selectQuestions } from '../game/quiz-questions';
import { rankPlayers } from '../game/ranking-calculator';
import { createWorld, stepWorld } from '../game/world-simulation';
import { buildPublicQuestion, judgeCurrentQuestion } from './match-messages';
import { PlayerRegistry, syncHandledInputs } from './player-registry';
import { buildSnapshotMessage } from './snapshot-builder';

// 한 방의 게임 진행을 맡는다. 소켓과 무관한 순수 로직이라 단위 테스트로 검증한다.
export class MatchController {
  private readonly world = createWorld();
  private readonly match = createLobbyMatch();
  private readonly registry: PlayerRegistry;
  private readonly inputReceivedPlayerIds = new Set<string>();
  private lastJudgement: JudgedMessage | null = null;
  private finalRankings: RankingEntry[] | null = null;

  // 대기실에서도 아이템을 주워 놀 수 있도록 처음부터 바닥에 깔아 둔다.
  constructor(
    private readonly config: GameConfig,
    private readonly questionPool: QuizQuestion[],
    private readonly random: RandomSource,
  ) {
    this.registry = new PlayerRegistry(this.world, config);
    resetItems(this.world, config, random);
  }

  isFull(): boolean {
    return this.registry.isFull();
  }

  hasPlayers(): boolean {
    return this.registry.hasAnyone();
  }

  hasSuspended(): boolean {
    return this.registry.hasSuspended();
  }

  hasPlayer(playerId: string): boolean {
    return this.registry.findPlayer(playerId) !== undefined;
  }

  isColorAvailable(colorIndex: number): boolean {
    return this.registry.isColorAvailable(colorIndex);
  }

  // 고른 색(캐릭터)으로 입장시킨다. 대기실이면 바로 경기장에 넣고, 게임 진행 중이면 다음 판까지 대기시킨다.
  addPlayer(playerId: string, nickname: string, colorIndex: number): PlayerEntity {
    return this.registry.add(playerId, nickname, colorIndex, this.pickSpawnPosition(), this.isMatchRunning());
  }

  // 게임 중 끊긴 사람은 유예 시간 동안 자리를 남겨 둔다. 경기장이 비면 대기실로 돌아간다.
  removePlayer(playerId: string, now: number): ServerMessage[] {
    this.registry.suspend(playerId, now, this.isMatchRunning());
    this.inputReceivedPlayerIds.delete(playerId);
    return this.collapseIfArenaEmpty();
  }

  // 유예 시간 안에 돌아오면 캐릭터·점수 그대로 복귀한다. 아직 자리가 살아 있어도(죽은 연결) 그 자리를 넘겨준다.
  resumePlayer(playerId: string): PlayerEntity | null {
    const player = this.registry.resume(playerId);
    if (player) {
      this.inputReceivedPlayerIds.delete(playerId);
    }
    return player;
  }

  // 첫 입력은 기준값으로만 쓴다. 입장 전에 눌렀던 버튼 횟수가 공격으로 처리되지 않게 한다.
  setInput(playerId: string, input: PlayerInput): void {
    const player = this.registry.findPlayer(playerId);
    if (!player) {
      return;
    }
    player.input = { ...input };
    if (!this.inputReceivedPlayerIds.has(playerId)) {
      this.inputReceivedPlayerIds.add(playerId);
      syncHandledInputs(player);
    }
  }

  // 누르고 있던 방향키·막기를 뗀 것으로 본다. 버튼 횟수는 그대로 두어, 다시 소식이 왔을 때 공격이 저절로 나가지 않게 한다.
  releaseKeys(playerId: string): void {
    const player = this.registry.findPlayer(playerId);
    if (player) {
      player.input = { ...createEmptyInput(), punchCount: player.input.punchCount, kickCount: player.input.kickCount };
    }
  }

  // 관리자가 시작하면 점수만 초기화한다(잠깐 끊긴 사람 포함). 캐릭터 위치와 바닥 아이템은 대기실에서 놀던 그대로 이어진다.
  startMatch(): ServerMessage[] {
    if (this.match.phase !== 'lobby' || this.world.players.size === 0 || this.questionPool.length === 0) {
      return [];
    }
    startMatch(this.match, selectQuestions(this.questionPool, this.config.timeline.questionCount, this.random), this.config);
    this.registry.resetScores();
    this.lastJudgement = null;
    this.finalRankings = null;
    return [{ type: 'question', question: null }, { type: 'zones', zones: [] }];
  }

  // 최종 순위 연출 중에는 난투를 멈춘다. 유예 시간이 지난 사람은 이때 내보낸다.
  tick(deltaSeconds: number, now: number): ServerMessage[] {
    if (this.match.phase !== 'final') {
      stepWorld(this.world, deltaSeconds, this.config, this.random);
    }
    const events = advanceMatch(this.match, deltaSeconds, this.config, this.random).flatMap((event) => this.handleMatchEvent(event));
    if (this.registry.expireSuspended(now, this.config.network.reconnectGraceSeconds)) {
      events.push(this.buildRosterMessage(), ...this.collapseIfArenaEmpty());
    }
    return events;
  }

  // 게임 중 경기장이 비어 대기실로 돌아갈 때 기다리던 사람을 경기장에 넣는다.
  // (관리자의 새 게임/중단은 방 자체를 새로 만들므로 여기를 거치지 않는다.)
  // 그동안 눌렀던 버튼이 한꺼번에 처리되지 않게 경기장 사람들의 처리 횟수도 맞춘다.
  private returnEveryoneToLobby(): ServerMessage[] {
    returnToLobby(this.match);
    this.world.meteors.clear();
    this.world.players.forEach(syncHandledInputs);
    this.registry.promoteWaiting();
    this.lastJudgement = null;
    this.finalRankings = null;
    return [{ type: 'question', question: null }, { type: 'zones', zones: [] }, this.buildRosterMessage()];
  }

  // 게임 중 경기장이 완전히 비고 돌아올 사람도 없으면, 빈 경기장으로 진행하지 않고 대기실로 돌아간다.
  private collapseIfArenaEmpty(): ServerMessage[] {
    const isArenaEmpty = this.world.players.size === 0 && !this.registry.hasSuspended();
    return this.isMatchRunning() && isArenaEmpty ? this.returnEveryoneToLobby() : [];
  }

  private isMatchRunning(): boolean {
    return this.match.phase !== 'lobby';
  }

  buildSnapshot(serverTime: number): ServerMessage {
    return buildSnapshotMessage(this.world, this.match, serverTime, this.config);
  }

  buildRosterMessage(): ServerMessage {
    return { type: 'roster', players: this.registry.buildRoster() };
  }

  // 중간에 들어온 사람에게 현재 문제·구역·판정·최종 순위를 맞춰 준다.
  buildSyncMessages(): ServerMessage[] {
    const isQuestionVisible = this.match.phase === 'question' || this.match.phase === 'between';
    const messages: ServerMessage[] = [
      { type: 'question', question: isQuestionVisible ? buildPublicQuestion(this.match, this.config) : null },
      { type: 'zones', zones: this.match.isZonesVisible ? this.match.zones : [] },
    ];
    if (this.match.phase === 'between' && this.lastJudgement) {
      messages.push(this.lastJudgement);
    }
    if (this.match.phase === 'final' && this.finalRankings) {
      messages.push({ type: 'finalResult', rankings: this.finalRankings });
    }
    return messages;
  }

  // 최종 순위에는 잠깐 끊긴 사람도 들어간다. 끊긴 채 끝나도 순위표에서 사라지지 않는다.
  private handleMatchEvent(event: MatchEvent): ServerMessage[] {
    switch (event) {
      case 'questionStarted':
        this.lastJudgement = null;
        return [{ type: 'question', question: buildPublicQuestion(this.match, this.config) }, { type: 'zones', zones: [] }];
      case 'zonesAppeared':
        return [{ type: 'zones', zones: this.match.zones }];
      case 'meteorStarted':
        spawnMeteor(this.world, this.config, this.random);
        return [];
      case 'questionJudged':
        this.lastJudgement = judgeCurrentQuestion(this.match, this.world, this.config);
        return [this.lastJudgement];
      case 'finalStarted':
        this.finalRankings = rankPlayers(this.registry.listCompetitors());
        return [{ type: 'finalResult', rankings: this.finalRankings }];
      default:
        return [];
    }
  }

  private pickSpawnPosition() {
    return pickRandomArenaPosition(this.config, this.random, this.config.player.radius * 2);
  }
}
