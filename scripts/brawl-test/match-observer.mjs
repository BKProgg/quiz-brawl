// 관전(관리자) 소켓으로 서버 상태를 받아, 매 스냅샷마다 불변식을 검사하고 일어난 일을 센다.
import { checkLiftPairs, checkMeteors, trackPlayer } from './snapshot-checks.mjs';

const BORDERLINE_PIXELS = 40;

export class MatchObserver {
  constructor(webSocketUrl, log) {
    Object.assign(this, { webSocketUrl, log, config: null, snapshot: null, snapshotCount: 0, roster: [], zones: [], question: null });
    Object.assign(this, { questionsSeen: 0, judgements: [], finalResult: null, scores: new Map(), violations: [], borderlineJudgements: 0 });
    Object.assign(this, { transitions: {}, blockingSeen: 0, logsSeen: new Set(), meteorImpacts: [], meteorsThisQuestion: new Set() });
    Object.assign(this, { lastMeteorState: new Map(), playerTracks: new Map(), travelled: new Map(), phaseLog: [] });
    Object.assign(this, { isStopped: false, isDisconnectExpected: false, toleratedEmptyLifts: 0, pingTimer: null });
    this.connect();
  }

  connect() {
    const socket = new WebSocket(this.webSocketUrl);
    this.socket = socket;
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'adminJoin' })));
    socket.addEventListener('message', (event) => this.handleMessage(JSON.parse(event.data)));
    socket.addEventListener('close', (event) => {
      if (!this.isStopped) {
        this.log(`관찰자 소켓 닫힘 (code ${event.code}, 사유 "${event.reason}")`);
        setTimeout(() => this.connect(), 300);
      }
    });
    this.pingTimer ??= setInterval(() => this.socket.readyState === 1 && this.socket.send(JSON.stringify({ type: 'ping', clientTime: 0 })), 2000);
  }

  stop() {
    this.isStopped = true;
    clearInterval(this.pingTimer);
    this.socket.close();
  }

  violate(kind, detail) {
    const existing = this.violations.find((violation) => violation.kind === kind);
    if (existing) {
      existing.count += 1;
      return;
    }
    this.violations.push({ kind, count: 1, detail });
    this.log(`!! 불변식 위반 [${kind}] ${detail}`);
  }

  // 조건이 참이 될 때까지 기다린다. 시간 안에 안 되면 false.
  waitFor(predicate, timeoutSeconds) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (predicate()) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - startedAt > timeoutSeconds * 1000) {
          clearInterval(timer);
          resolve(false);
        }
      }, 50);
    });
  }

  handleMessage(message) {
    if (message.type === 'adminWelcome') {
      this.config = message.config;
    } else if (message.type === 'roster') {
      this.roster = message.players;
    } else if (message.type === 'zones') {
      this.zones = message.zones;
    } else if (message.type === 'question') {
      this.question = message.question;
      if (message.question) {
        this.questionsSeen += 1;
        this.meteorsThisQuestion = new Set();
        this.log(`문제 ${message.question.index + 1}/${message.question.total} (${message.question.type}) 제한 ${message.question.countdownSeconds}초`);
      }
    } else if (message.type === 'judged') {
      this.checkJudgement(message);
    } else if (message.type === 'finalResult') {
      this.finalResult = message.rankings;
      this.checkFinalResult(message.rankings);
    } else if (message.type === 'snapshot') {
      this.checkSnapshot(message);
    }
  }

  checkSnapshot(snapshot) {
    const previous = this.snapshot;
    this.snapshot = snapshot;
    this.snapshotCount += 1;
    if (!previous || previous.phase !== snapshot.phase) {
      this.phaseLog.push(snapshot.phase);
      this.log(`단계: ${snapshot.phase}`);
    }
    const now = Date.now();
    const { arena } = this.config;
    snapshot.players.forEach((player) => {
      const isInside = player.x >= arena.left - 2 && player.x <= arena.right + 2 && player.y >= arena.top - 2 && player.y <= arena.bottom + 2;
      if (!Number.isFinite(player.x) || !Number.isFinite(player.y) || !isInside) {
        this.violate('경기장 밖 또는 잘못된 좌표', `${player.id} ${player.state} (${player.x}, ${player.y})`);
      }
      if (player.isBlocking) {
        this.blockingSeen += 1;
      }
      trackPlayer(this, player, now);
      if (player.heldItemId !== null && !snapshot.items.some((item) => item.id === player.heldItemId && item.state === 'held')) {
        this.violate('든 아이템이 목록에 없거나 held가 아님', `${player.id} → ${player.heldItemId}`);
      }
    });
    const holderCount = snapshot.players.filter((player) => player.heldItemId !== null).length;
    const heldCount = snapshot.items.filter((item) => item.state === 'held').length;
    if (holderCount !== heldCount) {
      this.violate('든 사람 수와 held 아이템 수 불일치', `든 사람 ${holderCount}, held ${heldCount} (단계 ${snapshot.phase})`);
    }
    // 경기장에서 빠진 사람(끊겨서 유예 중)은 상태 시간이 멈춘 채 돌아오므로, 지속 시간 기록을 버리고 돌아왔을 때부터 다시 잰다.
    const presentIds = new Set(snapshot.players.map((player) => player.id));
    [...this.playerTracks.keys()].filter((id) => !presentIds.has(id)).forEach((id) => this.playerTracks.delete(id));
    checkLiftPairs(this, snapshot);
    checkMeteors(this, snapshot);
    snapshot.logs.forEach((log) => this.logsSeen.add(log.id));
  }

  // 직전 스냅샷의 위치로 득점자를 다시 계산해 서버 판정과 비교한다. 구역 경계에 가까운 경우는 스냅샷 시차로 보고 따로 센다.
  checkJudgement(message) {
    const zone = this.zones.find((candidate) => candidate.choiceIndex === message.answerIndex);
    const players = this.snapshot?.players ?? [];
    const scorers = new Set(message.scorerIds);
    if (!zone) {
      this.violate('판정이 왔는데 정답 구역 정보가 없음', `answerIndex ${message.answerIndex}`);
      return;
    }
    players.forEach((player) => {
      const margin = Math.min(player.x - zone.x, zone.x + zone.width - player.x, player.y - zone.y, zone.y + zone.height - player.y);
      if ((margin >= 0) !== scorers.has(player.id)) {
        if (Math.abs(margin) > BORDERLINE_PIXELS) {
          this.violate('득점 판정이 위치와 다름', `${player.id} ${player.state} 구역 경계에서 ${margin.toFixed(0)}px, 득점 ${scorers.has(player.id)}`);
        } else {
          this.borderlineJudgements += 1;
        }
      }
      const expected = (this.scores.get(player.id) ?? 0) + (scorers.has(player.id) ? this.config.scoring.pointsPerCorrect : 0);
      if (message.scores[player.id] !== expected) {
        this.violate('점수 합계가 맞지 않음', `${player.id} 기대 ${expected}, 실제 ${message.scores[player.id]}`);
      }
    });
    const states = players.filter((player) => scorers.has(player.id)).map((player) => player.state);
    this.scores = new Map(Object.entries(message.scores));
    this.judgements.push({ answerIndex: message.answerIndex, scorerCount: message.scorerIds.length, scorerStates: states });
    this.log(`판정: 정답 ${message.answerIndex}, 득점 ${message.scorerIds.length}명 [${states.join(', ')}]`);
  }

  checkFinalResult(rankings) {
    rankings.forEach((entry, index) => {
      const above = rankings[index - 1];
      if (above && (above.score < entry.score || (above.score === entry.score && above.rank !== entry.rank) || above.rank > entry.rank)) {
        this.violate('최종 순위 정렬 또는 공동 순위 오류', JSON.stringify(rankings.map((ranking) => [ranking.rank, ranking.score])));
      }
      if ((this.scores.get(entry.playerId) ?? 0) !== entry.score) {
        this.violate('최종 점수가 마지막 판정 점수와 다름', `${entry.nickname} ${entry.score} vs ${this.scores.get(entry.playerId)}`);
      }
    });
    this.log(`최종 순위: ${rankings.map((entry) => `${entry.rank}위 ${entry.nickname} ${entry.score}`).join(' | ')}`);
  }

  // 새 판을 시작할 때 판 단위 기록만 지운다(위반·통계는 유지).
  resetMatchRecords() {
    Object.assign(this, { judgements: [], finalResult: null, scores: new Map(), questionsSeen: 0, playerTracks: new Map() });
  }
}
