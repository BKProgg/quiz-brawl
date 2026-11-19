// 2부: 다시 입장 → 게임 중 끊김·새로고침·퇴장·늦은 입장 → 게임 중단 → 대기실 새로고침.
import { sleep } from './browser-page.mjs';
import { joinGame, readPickerState, takeScreenshot, waitForPage } from './scenario-helpers.mjs';

const OFFLINE = { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const ONLINE = { ...OFFLINE, offline: false };

export async function runRejoinStep(run) {
  const { players, admin, observer, log, check } = run;
  log('=== 2부: 다시 입장 ===');
  observer.resetMatchRecords();
  for (let index = 0; index < 10; index += 1) {
    await joinGame(players[index], `재${index + 1}`, 11 - index);
  }
  await sleep(1200);
  const states = await Promise.all(players.map(readPickerState));
  check('2부: 10명 다시 입장', observer.roster.length === 10 && states.every((state) => state.isPickerHidden), `${observer.roster.length}명`);
  players.forEach((page) => page.tap('Escape'));
  run.bots.forEach((bot) => bot.start());
  await sleep(5000);
  check('2부: 시작 버튼 클릭', await admin.click('#admin-start-button'));
  await observer.waitFor(() => observer.snapshot.phase === 'question' && observer.snapshot.phaseRemaining <= 24, 20);
}

// 새로고침한 창이 같은 자리로 돌아오기까지 걸린 시간을 잰다.
async function reloadAndMeasure(run, page) {
  const welcomesBefore = page.welcomeCount;
  const reloadedAt = Date.now();
  await page.send('Page.reload');
  for (let attempt = 0; attempt < 140 && page.welcomeCount === welcomesBefore; attempt += 1) {
    await sleep(100);
  }
  const seconds = ((Date.now() - reloadedAt) / 1000).toFixed(1);
  await sleep(300);
  const state = await readPickerState(page);
  run.check('새로고침한 창이 같은 캐릭터로 복귀(선택 화면 없이)', state.isPickerHidden && page.welcomeCount === welcomesBefore + 1,
    `복귀까지 ${seconds}초, 선택 화면 숨김 ${state.isPickerHidden}`);
  await sleep(Math.max(0, 3000 - (Date.now() - reloadedAt)));
}

export async function runDisruptionStep(run) {
  const { players, admin, observer, browser, baseUrl, outputDirectory, log, check } = run;
  const offlinePage = players[2];
  const offlineId = offlinePage.playerId;
  const reloadPage = players[4];
  const reloadId = reloadPage.playerId;
  log(`--- 창3: 네트워크 끊김 10초 (플레이어 ${offlineId.slice(0, 8)}) ---`);
  observer.isDisconnectExpected = true;
  await offlinePage.send('Network.emulateNetworkConditions', OFFLINE);
  log('--- 창5: 새로고침 ---');
  await reloadAndMeasure(run, reloadPage);
  log('--- 창7: 창 닫기 ---');
  const closedId = players[6].playerId;
  run.bots[6].stop();
  await players[6].close();
  await sleep(7000);
  await offlinePage.send('Network.emulateNetworkConditions', ONLINE);
  await sleep(4000);
  const offlineState = await readPickerState(offlinePage);
  check('끊겼던 창이 게임 화면을 유지하고 같은 캐릭터', offlineState.isPickerHidden && offlinePage.playerId === offlineId,
    `소켓 ${offlinePage.socketsCreated}개, welcome ${offlinePage.welcomeCount}회`);
  const travelledBefore = observer.travelled.get(offlineId) ?? 0;
  await sleep(3000);
  check('끊겼던 창이 다시 움직임', (observer.travelled.get(offlineId) ?? 0) - travelledBefore > 100);
  await observer.waitFor(() => !observer.roster.some((player) => player.id === closedId), 20);
  check('창을 닫은 사람은 유예 15초 뒤 명단에서 빠짐', !observer.roster.some((player) => player.id === closedId), `명단 ${observer.roster.length}명`);
  observer.isDisconnectExpected = false;
  log('--- 늦은 입장 ---');
  run.latePage = await browser.openPage(`${baseUrl}/`, '늦은입장');
  await joinGame(run.latePage, '늦깎이', 0);
  await sleep(1500);
  const lateEntry = observer.roster.find((player) => player.id === run.latePage.playerId);
  check('게임 중 들어온 사람은 다음 판 대기', lateEntry !== undefined && lateEntry.isInWorld === false, JSON.stringify(lateEntry));
  check('대기 중인 사람은 경기장에 없음', !observer.snapshot.players.some((player) => player.id === run.latePage.playerId));
  await takeScreenshot(outputDirectory, run.latePage, '13-late-joiner');
  await takeScreenshot(outputDirectory, admin, '14-admin-midgame');
  await observer.waitFor(() => observer.judgements.length >= 2, 80);
  check('2부: 판정 2회 진행', observer.judgements.length >= 2, `${observer.judgements.length}회`);
  check('복귀한 두 사람의 점수가 서버에 유지됨', observer.scores.has(offlineId) && observer.scores.has(reloadId),
    `${observer.scores.get(offlineId)}, ${observer.scores.get(reloadId)}`);
}

export async function runAbortStep(run) {
  const { players, admin, observer, log, check } = run;
  log('=== 2부: 게임 중단 ===');
  check('관리자 게임 중단 버튼 클릭', await admin.click('#admin-new-game-button'));
  await sleep(3500);
  const survivors = [...players.filter((page) => !page.isClosed), run.latePage];
  const states = await Promise.all(survivors.map(readPickerState));
  check('중단 뒤 전원이 선택 화면으로', states.every((state) => !state.isPickerHidden && state.enabledTiles === 12),
    JSON.stringify(states.map((state) => [state.isPickerHidden, state.enabledTiles])));
  check('중단 뒤 서버가 대기실·빈 명단', observer.roster.length === 0 && observer.snapshot.phase === 'lobby',
    `${observer.roster.length}명, ${observer.snapshot.phase}`);
  run.bots.forEach((bot) => bot.stop());
}

export async function runLobbyReloadStep(run) {
  const { players, log, check } = run;
  log('=== 대기실에서 새로고침 ===');
  await joinGame(players[0], '혼자', 5);
  await sleep(1000);
  await players[0].send('Page.reload');
  await sleep(500);
  await waitForPage(players[0], `document.querySelectorAll('.character-tile:not([disabled])').length===12`, 12);
  await sleep(1500);
  const state = await readPickerState(players[0]);
  check('대기실에서 새로고침하면 자리가 사라졌다는 안내와 함께 다시 고를 수 있음',
    !state.isPickerHidden && state.message.includes('이전 자리') && state.enabledTiles === 12, JSON.stringify(state));
}
