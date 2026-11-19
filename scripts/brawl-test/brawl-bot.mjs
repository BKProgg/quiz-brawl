// 브라우저 창 하나를 실제 키보드 입력으로 조종하는 난투 봇. 서버 상태(관찰자)를 보고 가까운 상대에게 달려가 싸운다.
const DIRECTIONS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const pickBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);

export class BrawlBot {
  constructor(page, observer) {
    Object.assign(this, { page, observer, liftPlan: null, blockUntil: 0, zoneChoice: 0, rushSeconds: 8, lastQuestionIndex: -1, timer: null });
  }

  start() {
    this.timer = setInterval(() => this.decide(), pickBetween(130, 190));
  }

  stop() {
    clearInterval(this.timer);
    this.page.holdKeys(new Set());
  }

  decide() {
    const snapshot = this.observer.snapshot;
    const me = snapshot?.players.find((player) => player.id === this.page.playerId);
    if (!me || this.page.isClosed) {
      this.page.holdKeys(new Set());
      return;
    }
    this.pickZoneForQuestion();
    const now = Date.now();
    if (me.state === 'lifting') {
      this.actWhileLifting(now);
      return;
    }
    this.liftPlan = null;
    if (now < this.blockUntil) {
      return;
    }
    const nearest = this.findNearest(me, snapshot.players.filter((player) => player.id !== me.id));
    if (me.state === 'free' && nearest && nearest.distance < 75) {
      this.fight(me, nearest.target, now);
      return;
    }
    this.moveAndUseItems(me, snapshot, nearest);
  }

  pickZoneForQuestion() {
    const index = this.observer.question?.index ?? -1;
    if (index !== this.lastQuestionIndex) {
      this.lastQuestionIndex = index;
      this.zoneChoice = Math.floor(Math.random() * 4);
      this.rushSeconds = pickBetween(3, 12);
    }
  }

  findNearest(me, candidates) {
    return candidates.map((target) => ({ target, distance: Math.hypot(target.x - me.x, target.y - me.y) }))
      .sort((first, second) => first.distance - second.distance)[0] ?? null;
  }

  directionKeysToward(me, goal, deadZone = 10) {
    const keys = new Set();
    if (goal.x - me.x > deadZone) keys.add('ArrowRight');
    if (goal.x - me.x < -deadZone) keys.add('ArrowLeft');
    if (goal.y - me.y > deadZone) keys.add('ArrowDown');
    if (goal.y - me.y < -deadZone) keys.add('ArrowUp');
    return keys;
  }

  // 든 동안: 무작위 방향으로 걷다가 던진다. 가끔은 끝까지 안 던져서 탈출을 일으킨다.
  actWhileLifting(now) {
    if (!this.liftPlan) {
      const direction = DIRECTIONS[Math.floor(Math.random() * 4)];
      this.liftPlan = { direction, throwAt: Math.random() < 0.2 ? Infinity : now + pickBetween(250, 1300), isThrown: false };
    }
    this.page.holdKeys(new Set([this.liftPlan.direction]));
    if (!this.liftPlan.isThrown && now >= this.liftPlan.throwAt) {
      this.liftPlan.isThrown = true;
      this.page.tap('KeyZ');
    }
  }

  fight(me, target, now) {
    const roll = Math.random();
    if (roll < 0.35) {
      this.page.holdKeys(new Set());
      setTimeout(() => this.page.tap('KeyZ'), 30);
    } else if (roll < 0.55) {
      this.page.tap('KeyX');
    } else if (roll < 0.65) {
      this.blockUntil = now + pickBetween(300, 600);
      this.page.holdKeys(new Set(['KeyC']));
    } else if (roll < 0.95) {
      this.page.holdKeys(this.directionKeysToward(me, target, 4));
      setTimeout(() => this.page.tap('KeyZ'), 60);
    }
  }

  moveAndUseItems(me, snapshot, nearest) {
    const { phase, phaseRemaining } = snapshot;
    const zone = this.observer.zones[this.zoneChoice % Math.max(1, this.observer.zones.length)];
    const floorItem = this.findNearest(me, snapshot.items.filter((item) => item.state === 'floor'));
    let goal = nearest?.target ?? { x: 800, y: 480 };
    if (phase === 'question' && zone && phaseRemaining < this.rushSeconds) {
      goal = { x: zone.x + zone.width / 2 + pickBetween(-80, 80), y: zone.y + zone.height / 2 + pickBetween(-60, 60) };
    } else if (me.heldItemId === null && floorItem && floorItem.distance < 260) {
      goal = floorItem.target;
    }
    this.page.holdKeys(this.directionKeysToward(me, goal));
    if (me.state !== 'free') {
      return;
    }
    if (me.heldItemId !== null && Math.random() < 0.12) {
      this.page.tap('KeyZ');
    } else if (me.heldItemId === null && floorItem && floorItem.distance < 38 && Math.random() < 0.6) {
      this.page.holdKeys(new Set());
      setTimeout(() => this.page.tap('KeyZ'), 30);
    }
  }
}
