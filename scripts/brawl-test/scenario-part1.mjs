// 1부: 입장(동시 같은 색, 정원 초과) → 대기실 난투 → 한 판 전체 → 최종 결과 → 새 게임.
import { BrawlBot } from './brawl-bot.mjs';
import { sleep } from './browser-page.mjs';
import {
  joinGame, measureFrameCost, readHeaps, readPickerState, sampleFrames, takeScreenshot, tileSelector, typeNickname, waitForPage,
} from './scenario-helpers.mjs';

const MATCH_TIMEOUT_SECONDS = 300;
// question 메시지: 입장 동기화(null) + 시작(null) + 문제 6개
const EXPECTED_MESSAGE_COUNTS = { question: 8, judged: 6, finalResult: 1 };

export async function runEntryStep(run) {
  const { players, admin, observer, browser, baseUrl, log, check } = run;
  log('=== 1부: 입장 ===');
  await waitForPage(admin, `document.querySelector('#admin-status').textContent.includes('대기 중')`);
  for (let index = 0; index < 8; index += 1) {
    await joinGame(players[index], `선수${index + 1}`, index);
  }
  await typeNickname(players[8], '동시9');
  await typeNickname(players[9], '동시10');
  const racePoints = await Promise.all([players[8].locate(tileSelector(8)), players[9].locate(tileSelector(8))]);
  await Promise.all([players[8].clickAt(racePoints[0]), players[9].clickAt(racePoints[1])]);
  await sleep(1200);
  const racers = await Promise.all([readPickerState(players[8]), readPickerState(players[9])]);
  const loserIndex = racers.findIndex((state) => !state.isPickerHidden);
  check('같은 색을 동시에 누르면 한 명만 입장', racers.filter((state) => state.isPickerHidden).length === 1, JSON.stringify(racers));
  if (loserIndex >= 0) {
    const loser = racers[loserIndex];
    check('밀린 사람에게 안내 문구가 뜨고 다시 고를 수 있음', loser.message.includes('먼저') && loser.enabledTiles > 0, loser.message);
    await joinGame(players[8 + loserIndex], loserIndex === 0 ? '동시9' : '동시10', 9);
  }
  await sleep(1000);
  const joinedStates = await Promise.all(players.map(readPickerState));
  check('10명 모두 입장(선택 화면 닫힘)', joinedStates.every((state) => state.isPickerHidden), `${joinedStates.filter((s) => s.isPickerHidden).length}/10`);
  check('서버 참가자 명단 10명', observer.roster.length === 10 && observer.roster.every((player) => player.isInWorld), `${observer.roster.length}명`);
  const eleventh = await browser.openPage(`${baseUrl}/`, '11번째');
  await joinGame(eleventh, '초과', 10);
  await sleep(1200);
  const eleventhState = await readPickerState(eleventh);
  check('11번째 사람은 정원 초과 안내', !eleventhState.isPickerHidden && eleventhState.message.includes('가득'), eleventhState.message);
  await eleventh.close();
  players.forEach((page) => page.tap('Escape'));
  await sleep(1600);
  check('튜토리얼이 Esc로 닫힘', (await Promise.all(players.map((page) => page.evaluate(`document.querySelector('#tutorial').hidden`)))).every(Boolean));
  check('관리자 화면 참가자 수 10', (await admin.evaluate(`document.querySelector('#admin-player-count').textContent`)) === '10');
}

export async function runLobbyBrawlStep(run) {
  const { players, admin, observer, outputDirectory, log } = run;
  log('=== 1부: 대기실 난투 ===');
  run.bots = players.map((page) => new BrawlBot(page, observer));
  run.bots.forEach((bot) => bot.start());
  run.heapsAtStart = await readHeaps(run.allPages());
  await admin.send('Performance.enable');
  run.frameCostAtStart = await measureFrameCost(admin, 4);
  await sampleFrames(run.allPages(), 8, run.frameSamples);
  await takeScreenshot(outputDirectory, players[0], '01-lobby-player');
  await takeScreenshot(outputDirectory, admin, '02-lobby-admin');
  await sleep(6000);
}

async function captureMatchMoments(run) {
  const { players, admin, observer, outputDirectory } = run;
  const shot = (page, name) => takeScreenshot(outputDirectory, page, name);
  await observer.waitFor(() => observer.zones.length > 0, 20);
  await shot(players[0], '03-zones-player');
  await observer.waitFor(() => observer.snapshot.meteors.some((meteor) => meteor.state === 'warning'), 30);
  await sleep(900);
  await shot(players[1], '04-meteor-warning-player');
  await shot(admin, '05-meteor-warning-admin');
  await observer.waitFor(() => observer.snapshot.meteors.some((meteor) => meteor.state === 'impact'), 5);
  await shot(players[1], '06-meteor-impact-player');
  await observer.waitFor(() => observer.snapshot.phase === 'question' && observer.snapshot.phaseRemaining <= 3, 12);
  await shot(players[2], '07-countdown-player');
  await observer.waitFor(() => observer.judgements.length >= 1, 8);
  await sleep(700);
  await shot(players[2], '08-judged-player');
  await shot(admin, '09-judged-admin');
}

export async function runFullMatchStep(run) {
  const { players, admin, observer, outputDirectory, startedAt, log, check } = run;
  log('=== 1부: 한 판 전체 ===');
  check('관리자 시작 버튼 클릭', await admin.click('#admin-start-button'));
  check('게임이 시작됨(intro)', await observer.waitFor(() => observer.snapshot?.phase === 'intro', 3));
  const frameLoop = (async () => {
    while (observer.finalResult === null && Date.now() - startedAt < 400_000) {
      await sampleFrames(run.allPages(), 5, run.frameSamples);
    }
  })();
  await captureMatchMoments(run);
  check('한 판이 끝까지 진행됨(최종 결과 수신)', await observer.waitFor(() => observer.finalResult !== null, MATCH_TIMEOUT_SECONDS));
  await frameLoop;
  run.bots.forEach((bot) => bot.stop());
  await sleep(5000);
  await takeScreenshot(outputDirectory, players[0], '10-final-player');
  await takeScreenshot(outputDirectory, players[9], '11-final-player10');
  await takeScreenshot(outputDirectory, admin, '12-final-admin');
  check('문제 6개가 모두 출제·판정됨', observer.questionsSeen === 6 && observer.judgements.length === 6,
    `출제 ${observer.questionsSeen}, 판정 ${observer.judgements.length}`);
  const impacts = observer.meteorImpacts;
  check('메테오가 문제마다 1번씩 착지', impacts.length === 6, `착지 ${impacts.length}회: ${impacts.join(', ')}`);
  const countProblems = players.flatMap((page) => Object.entries(EXPECTED_MESSAGE_COUNTS)
    .filter(([type, count]) => (page.received[type] ?? 0) !== count)
    .map(([type, count]) => `${page.label} ${type} ${page.received[type] ?? 0}/${count}`));
  check('창 10개가 문제·판정·최종 결과를 빠짐없이 받음', countProblems.length === 0, countProblems.join(', '));
  const reconnected = run.allPages().filter((page) => page.socketsCreated !== 1).map((page) => `${page.label} ${page.socketsCreated}회`);
  check('한 판 동안 어느 창도 재접속하지 않음(인터넷 끊김이면 자동 복귀 여부를 아래에서 확인)', reconnected.length === 0, reconnected.join(', '));
  const rankingText = JSON.stringify(observer.finalResult);
  const finalRankingsOf = (page) => JSON.stringify(page.messages.find((message) => message.type === 'finalResult')?.rankings);
  const mismatched = players.filter((page) => finalRankingsOf(page) !== rankingText);
  check('모든 창의 최종 순위가 서버와 같음', mismatched.length === 0, mismatched.map((page) => page.label).join(', '));
  const idleBots = players.filter((page) => (observer.travelled.get(page.playerId) ?? 0) < 3000).map((page) => page.label);
  check('창 10개 모두 키 입력으로 실제 이동함', idleBots.length === 0, idleBots.join(', '));
  check('관리자 화면이 최종 결과 상태', (await admin.evaluate(`document.querySelector('#admin-new-game-button').textContent`)) === '새 게임');
}

export async function runNewGameStep(run) {
  const { players, admin, observer, log, check } = run;
  log('=== 1부: 새 게임 ===');
  check('관리자 새 게임 버튼 클릭', await admin.click('#admin-new-game-button'));
  await sleep(3500);
  check('새 게임 확인 창이 떴음', admin.dialogs.length === 1, admin.dialogs[0]?.slice(0, 20));
  const resetStates = await Promise.all(players.map(readPickerState));
  check('전원이 선택 화면으로 돌아오고 바로 고를 수 있음', resetStates.every((state) => !state.isPickerHidden && state.enabledTiles === 12),
    JSON.stringify(resetStates.map((state) => [state.isPickerHidden, state.enabledTiles])));
  check('서버 명단이 비고 대기실로 돌아감', observer.roster.length === 0 && observer.snapshot.phase === 'lobby',
    `${observer.roster.length}명, ${observer.snapshot.phase}`);
}
