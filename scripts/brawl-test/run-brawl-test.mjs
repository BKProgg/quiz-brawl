// 브라우저 창 10개(플레이어) + 관리자 창 1개로 실제 게임을 처음부터 끝까지 돌리며 검증한다. (macOS, Google Chrome 필요)
// 사용법: node scripts/brawl-test/run-brawl-test.mjs [주소] [결과 폴더]
//   예) node scripts/brawl-test/run-brawl-test.mjs http://127.0.0.1:8787
//       node scripts/brawl-test/run-brawl-test.mjs https://quiz-brawl.efin-quiz.workers.dev
// 결과 폴더에 화면 캡처와 summary.json이 남는다. 검사가 하나라도 실패하면 종료 코드 1.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';

import { launchBrowser } from './browser-launcher.mjs';
import { sleep } from './browser-page.mjs';
import { MatchObserver } from './match-observer.mjs';
import { createRecorder, measureFrameCost, readHeaps, summarizeFrames } from './scenario-helpers.mjs';
import { runEntryStep, runFullMatchStep, runLobbyBrawlStep, runNewGameStep } from './scenario-part1.mjs';
import { runAbortStep, runDisruptionStep, runLobbyReloadStep, runRejoinStep } from './scenario-part2.mjs';

const EXPECTED_ERROR_PATTERNS = ['fonts.g', 'ERR_INTERNET_DISCONNECTED'];
const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const defaultOutputDirectory = joinPath(tmpdir(), 'quiz-brawl-test', new Date().toISOString().replace(/[:.]/g, '-'));
const outputDirectory = process.argv[3] ?? defaultOutputDirectory;
mkdirSync(outputDirectory, { recursive: true });

async function openPages(browser) {
  const admin = await browser.openPage(`${baseUrl}/admin`, '관리자');
  const players = [];
  for (let index = 0; index < 10; index += 1) {
    players.push(await browser.openPage(`${baseUrl}/`, `창${index + 1}`));
  }
  return { admin, players };
}

function runFinalChecks(run, frameCostAtEnd) {
  const { observer, check, frameSamples } = run;
  const everyPage = [...run.allPages(), run.latePage];
  check('관리자 화면의 프레임당 작업 시간이 6분 뒤에도 늘지 않음', frameCostAtEnd < run.frameCostAtStart + 0.5,
    `시작 ${run.frameCostAtStart.toFixed(2)}ms → 끝 ${frameCostAtEnd.toFixed(2)}ms`);
  const pageErrors = [...new Set(everyPage.flatMap((page) => page.errors.map((error) => `${page.label}: ${error}`))
    .filter((error) => !EXPECTED_ERROR_PATTERNS.some((pattern) => error.includes(pattern))))];
  check('브라우저 콘솔 오류·예외 없음', pageErrors.length === 0, pageErrors.slice(0, 8).join(' | '));
  const violationText = observer.violations.map((violation) => `${violation.kind} ×${violation.count}`).join(' | ');
  check('서버 불변식 위반 없음', observer.violations.length === 0, violationText);
  const frameSummary = summarizeFrames(frameSamples);
  check('모든 창이 초당 30프레임 이상 유지', frameSummary.every((entry) => entry.minimum >= 30),
    frameSummary.map((entry) => `${entry.label} 최저 ${entry.minimum}/평균 ${entry.average}`).join(', '));
  return { pageErrors, frameSummary };
}

async function main() {
  const startedAt = Date.now();
  const { checks, log, check } = createRecorder(startedAt);
  const browser = await launchBrowser(joinPath(outputDirectory, 'chrome-profile'), 9340);
  const observer = new MatchObserver(`${baseUrl.replace(/^http/, 'ws')}/ws`, log);
  const { admin, players } = await openPages(browser);
  const run = { browser, observer, admin, players, baseUrl, outputDirectory, startedAt, log, check };
  Object.assign(run, { frameSamples: new Map(), bots: [], latePage: null });
  run.allPages = () => [admin, ...players];
  const steps = [
    runEntryStep, runLobbyBrawlStep, runFullMatchStep, runNewGameStep, runRejoinStep, runDisruptionStep, runAbortStep, runLobbyReloadStep,
  ];
  for (const step of steps) {
    await step(run);
  }
  await sleep(1500);
  const frameCostAtEnd = await measureFrameCost(admin, 4);
  const { pageErrors, frameSummary } = runFinalChecks(run, frameCostAtEnd);
  const heapsAtEnd = await readHeaps(run.allPages());
  const everyPage = [...run.allPages(), run.latePage];
  const summary = {
    checks,
    violations: observer.violations,
    borderlineJudgements: observer.borderlineJudgements,
    toleratedEmptyLifts: observer.toleratedEmptyLifts,
    judgements: observer.judgements,
    meteorImpacts: observer.meteorImpacts,
    transitions: observer.transitions,
    blockingSnapshots: observer.blockingSeen,
    logsSeen: observer.logsSeen.size,
    snapshotCount: observer.snapshotCount,
    frameSummary,
    heapMegabytes: run.allPages().map((page, index) => ({ label: page.label, start: run.heapsAtStart[index], end: heapsAtEnd[index] })),
    socketCounts: everyPage.map((page) => ({
      label: page.label, created: page.socketsCreated, closed: page.socketsClosed, sent: page.sentCount, snapshots: page.snapshotCount,
    })),
    connectionEvents: everyPage.map((page) => ({ label: page.label, events: page.connectionEvents })),
    pageErrors,
  };
  writeFileSync(joinPath(outputDirectory, 'summary.json'), JSON.stringify(summary, null, 2));
  const failed = checks.filter((entry) => !entry.isPassed);
  log(`=== 끝: 검사 ${checks.length}개 중 실패 ${failed.length}개, 불변식 위반 ${observer.violations.length}종, 결과 폴더 ${outputDirectory} ===`);
  observer.stop();
  browser.close();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('테스트 실행 실패:', error);
  process.exit(1);
});
