// 혼자서도 10명 난투를 해 볼 수 있게 AI 봇을 게임에 넣는다. 봇은 가장 가까운 상대를 쫓아가 때리고·들어 던지고·물건을 던진다.
// 사용법: node scripts/run-brawl-bots.mjs [주소] [봇 수] [실행 시간(분)]
// 게임 시작·새 게임은 사람이 관리자 화면(/admin)에서 누른다. 방이 초기화되면 봇은 사람이 먼저 고르도록 잠시 기다렸다가 다시 들어온다.
const baseUrl = process.argv[2] ?? 'https://quiz-brawl.efin-quiz.workers.dev';
const botCount = Number(process.argv[3] ?? 9);
const runMinutes = Number(process.argv[4] ?? 30);
const socketUrl = `${baseUrl.replace(/^http/, 'ws')}/ws`;
const COLOR_COUNT = 12;
const CLOSE_RANGE = 70;
const UNHITTABLE_STATES = new Set(['down', 'airborne', 'grabbed']);
const COMPASS = [
  ['isRightPressed'], ['isRightPressed', 'isDownPressed'], ['isDownPressed'], ['isLeftPressed', 'isDownPressed'],
  ['isLeftPressed'], ['isLeftPressed', 'isUpPressed'], ['isUpPressed'], ['isRightPressed', 'isUpPressed'],
];
const pickBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);

class BrawlBot {
  constructor(number) {
    this.number = number;
    this.resetGameState();
    this.connect(number * 400);
  }

  resetGameState() {
    Object.assign(this, { playerId: null, roster: [], snapshot: null, zones: [], questionIndex: -1 });
    Object.assign(this, { keys: [], isBlocking: false, punchCount: 0, kickCount: 0, lastSent: '', liftPlan: null, blockUntil: 0, targetZone: null });
  }

  // 붙은 뒤 조금 기다렸다가 입장한다. 끊기면(방 초기화 포함) 다시 붙고, 이때는 사람이 캐릭터를 먼저 고르도록 더 오래 기다린다.
  connect(joinDelayMilliseconds) {
    const socket = new WebSocket(socketUrl);
    this.socket = socket;
    socket.addEventListener('open', () => setTimeout(() => this.join(), joinDelayMilliseconds));
    socket.addEventListener('message', (event) => this.handleMessage(JSON.parse(event.data)));
    socket.addEventListener('close', () => {
      this.resetGameState();
      setTimeout(() => this.connect(6000 + this.number * 400), 1500);
    });
  }

  send(message) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  // 사람이 앞쪽 색을 고르기 쉽게 봇은 뒤쪽 색부터 쓴다. 자리가 없으면 잠시 뒤 다시 본다.
  join() {
    if (this.playerId !== null) {
      return;
    }
    const usedColors = new Set(this.roster.map((player) => player.colorIndex));
    const freeColors = Array.from({ length: COLOR_COUNT }, (_, index) => COLOR_COUNT - 1 - index).filter((color) => !usedColors.has(color));
    const colorIndex = freeColors[Math.floor(Math.random() * Math.min(3, freeColors.length))];
    if (colorIndex === undefined || this.roster.length >= botCount + 1) {
      setTimeout(() => this.join(), 3000);
      return;
    }
    this.send({ type: 'join', nickname: `봇${this.number + 1}`, colorIndex });
  }

  handleMessage(message) {
    if (message.type === 'welcome') {
      this.playerId = message.playerId;
      this.sendInput();
    } else if (message.type === 'rejected') {
      setTimeout(() => this.join(), pickBetween(500, 1500));
    } else if (message.type === 'roster') {
      this.roster = message.players;
    } else if (message.type === 'zones') {
      this.zones = message.zones;
    } else if (message.type === 'question' && message.question && message.question.index !== this.questionIndex) {
      this.questionIndex = message.question.index;
      this.targetZone = null;
    } else if (message.type === 'snapshot') {
      this.snapshot = message;
    }
  }

  sendInput() {
    const input = { isUpPressed: false, isDownPressed: false, isLeftPressed: false, isRightPressed: false };
    this.keys.forEach((key) => {
      input[key] = true;
    });
    const counts = { punchCount: this.punchCount, kickCount: this.kickCount };
    const payload = JSON.stringify({ type: 'input', ...input, isBlockPressed: this.isBlocking, ...counts });
    if (payload !== this.lastSent) {
      this.lastSent = payload;
      this.socket.send(payload);
    }
  }

  // 목표 쪽으로 가는 8방향 키와, 그 방향이 목표와 얼마나 어긋나는지(도)를 돌려준다.
  aimAt(me, goal) {
    const angle = Math.atan2(goal.y - me.y, goal.x - me.x);
    const sector = Math.round(angle / (Math.PI / 4));
    return { keys: COMPASS[(sector + 8) % 8], deviationDegrees: Math.abs(angle - sector * (Math.PI / 4)) * (180 / Math.PI) };
  }

  findNearest(me, candidates) {
    return candidates.map((target) => ({ target, distance: Math.hypot(target.x - me.x, target.y - me.y) }))
      .sort((first, second) => first.distance - second.distance)[0] ?? null;
  }

  // 약 0.12초마다 다음 행동을 정한다.
  decide() {
    const me = this.snapshot?.players.find((player) => player.id === this.playerId);
    if (!me || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const now = Date.now();
    const others = this.snapshot.players.filter((player) => player.id !== me.id);
    const hittable = others.filter((player) => !UNHITTABLE_STATES.has(player.state) && !player.isInvincible);
    const nearest = this.findNearest(me, hittable.length > 0 ? hittable : others);
    this.isBlocking = now < this.blockUntil;
    if (me.state === 'lifting') {
      this.carryAndThrow(now);
    } else if (!this.isBlocking) {
      this.liftPlan = null;
      if (me.state === 'free' && nearest && nearest.distance < CLOSE_RANGE) {
        this.attack(me, nearest.target, now);
      } else {
        this.chase(me, nearest);
      }
    }
    this.sendInput();
  }

  // 든 사람을 아무 방향으로나 끌고 가다 곧바로 던진다.
  carryAndThrow(now) {
    this.liftPlan ??= { keys: COMPASS[Math.floor(Math.random() * 8)], throwAt: now + pickBetween(250, 700) };
    this.keys = this.liftPlan.keys;
    if (now >= this.liftPlan.throwAt) {
      this.liftPlan.throwAt = Infinity;
      this.punchCount += 1;
    }
  }

  // 붙었으면 들기(상대 쪽 방향키 + 주먹) · 주먹 · 발차기를 섞어 쓰고, 가끔 막는다.
  attack(me, target, now) {
    const roll = Math.random();
    if (roll < 0.4) {
      this.keys = this.aimAt(me, target).keys;
      this.punchCount += 1;
    } else if (roll < 0.75) {
      this.keys = [];
      this.punchCount += 1;
    } else if (roll < 0.95) {
      this.keys = this.aimAt(me, target).keys;
      this.kickCount += 1;
    } else {
      this.keys = [];
      this.blockUntil = now + pickBetween(250, 450);
    }
  }

  // 평소에는 가장 가까운 상대를 쫓고, 가는 길에 물건을 주워 방향이 맞으면 던진다. 판정이 다가오면 고른 정답 칸으로 달려간다.
  chase(me, nearest) {
    const { phase, phaseRemaining, items } = this.snapshot;
    const floorItem = this.findNearest(me, items.filter((item) => item.state === 'floor'));
    let goal = nearest?.target ?? { x: 800, y: 480 };
    if (phase === 'question' && this.zones.length > 0 && phaseRemaining < 7) {
      this.targetZone ??= this.zones[Math.floor(Math.random() * this.zones.length)];
      goal = { x: this.targetZone.x + this.targetZone.width / 2, y: this.targetZone.y + this.targetZone.height / 2 };
    } else if (me.heldItemId === null && floorItem && floorItem.distance < 220) {
      goal = floorItem.target;
    }
    const isAtGoal = Math.hypot(goal.x - me.x, goal.y - me.y) < 14;
    this.keys = isAtGoal ? [] : this.aimAt(me, goal).keys;
    if (me.state !== 'free') {
      return;
    }
    if (me.heldItemId === null && floorItem && floorItem.distance < 36) {
      this.keys = [];
      this.punchCount += 1;
    } else if (me.heldItemId !== null && nearest && nearest.distance < 520) {
      const aim = this.aimAt(me, nearest.target);
      if (aim.deviationDegrees < 10) {
        this.keys = aim.keys;
        this.punchCount += 1;
      }
    }
  }
}

const bots = Array.from({ length: botCount }, (_, index) => new BrawlBot(index));
setInterval(() => bots.forEach((bot) => bot.decide()), 120);
setInterval(() => bots.forEach((bot) => bot.send({ type: 'ping', clientTime: 0 })), 2000);
setInterval(() => {
  const snapshot = bots.find((bot) => bot.snapshot)?.snapshot;
  const joinedCount = bots.filter((bot) => bot.playerId !== null).length;
  console.log(`봇 ${joinedCount}/${botCount}명 입장 · 경기장 ${snapshot?.players.length ?? 0}명 · 단계 ${snapshot?.phase ?? '-'}`);
}, 30_000);
console.log(`${baseUrl} 에 봇 ${botCount}명을 넣습니다. ${runMinutes}분 뒤 자동으로 나갑니다. (Ctrl+C로 바로 종료)`);
setTimeout(() => process.exit(0), runMinutes * 60_000);
