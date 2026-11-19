// 스냅샷 하나에 대한 불변식 검사: 상태 지속 시간, 들기 짝, 메테오.
const STATE_LIMIT_SECONDS = { punching: 1.0, kicking: 1.2, lifting: 2.0, tossing: 0.8, stunned: 1.6, grabbed: 2.0, airborne: 1.0, down: 2.0 };

export function trackPlayer(observer, player, now) {
  const track = observer.playerTracks.get(player.id);
  if (!track || track.state !== player.state) {
    observer.playerTracks.set(player.id, { state: player.state, since: now, isReported: false, x: player.x, y: player.y });
    const key = `${track?.state ?? '-'}→${player.state}`;
    observer.transitions[key] = (observer.transitions[key] ?? 0) + 1;
    return;
  }
  observer.travelled.set(player.id, (observer.travelled.get(player.id) ?? 0) + Math.hypot(player.x - track.x, player.y - track.y));
  track.x = player.x;
  track.y = player.y;
  // 최종 결과 화면에서는 난투가 멈추므로(의도) 상태 지속 시간을 검사하지 않는다.
  const limit = observer.snapshot.phase === 'final' ? undefined : STATE_LIMIT_SECONDS[player.state];
  if (limit !== undefined && !track.isReported && (now - track.since) / 1000 > limit) {
    track.isReported = true;
    observer.violate(`상태가 너무 오래 지속됨 (${player.state})`, `${player.id} ${((now - track.since) / 1000).toFixed(2)}초 넘게 ${player.state}`);
  }
}

// 든 사람과 들린 사람은 항상 짝이 맞고, 들린 사람은 든 사람과 같은 x, 1픽셀 아래에 있어야 한다.
// 들린 사람의 연결이 끊기면 돌아올 때까지 든 사람은 든 자세로 남는다(의도). 끊김을 일부러 낸 구간에서는 따로 센다.
export function checkLiftPairs(observer, snapshot) {
  const lifters = snapshot.players.filter((player) => player.state === 'lifting');
  const grabbed = snapshot.players.filter((player) => player.state === 'grabbed');
  const isPair = (lifter, target) => Math.abs(lifter.x - target.x) <= 3 && Math.abs(target.y - lifter.y - 1) <= 3;
  grabbed.filter((target) => !lifters.some((lifter) => isPair(lifter, target)))
    .forEach((target) => observer.violate('들린 사람에게 든 사람이 없음', `${target.id} (${target.x}, ${target.y})`));
  lifters.filter((lifter) => !grabbed.some((target) => isPair(lifter, target))).forEach((lifter) => {
    if (observer.isDisconnectExpected) {
      observer.toleratedEmptyLifts += 1;
    } else {
      observer.violate('든 사람에게 들린 사람이 없음', `${lifter.id} (${lifter.x}, ${lifter.y})`);
    }
  });
}

export function checkMeteors(observer, snapshot) {
  snapshot.meteors.forEach((meteor) => {
    if (snapshot.phase !== 'question') {
      observer.violate('문제 단계가 아닌데 메테오가 있음', `${meteor.id} 단계 ${snapshot.phase}`);
    }
    observer.meteorsThisQuestion.add(meteor.id);
    if (observer.meteorsThisQuestion.size > 1) {
      observer.violate('한 문제에 메테오가 2개 이상', [...observer.meteorsThisQuestion].join(', '));
    }
    if (observer.lastMeteorState.get(meteor.id) !== meteor.state && meteor.state === 'impact') {
      observer.meteorImpacts.push(snapshot.phaseRemaining);
      observer.log(`메테오 착지: 판정까지 ${snapshot.phaseRemaining}초`);
      const { minLandRemainingSeconds, maxLandRemainingSeconds } = observer.config.meteor;
      if (snapshot.phaseRemaining < minLandRemainingSeconds - 0.3 || snapshot.phaseRemaining > maxLandRemainingSeconds + 0.3) {
        observer.violate('메테오 착지 시점이 5~8초 범위를 벗어남', `판정까지 ${snapshot.phaseRemaining}초`);
      }
    }
    observer.lastMeteorState.set(meteor.id, meteor.state);
  });
}
