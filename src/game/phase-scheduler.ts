import type { GameConfig } from './game-config';
import type { GamePhase, MatchState, QuizQuestion, RandomSource } from './game-types';

import { placeAnswerZones } from './answer-judge';
import { getCountdownSeconds } from './quiz-questions';

// 1/30초 틱이 누적되며 생기는 부동소수점 오차 때문에 단계가 한 틱 늦게 넘어가지 않도록 허용 오차를 둔다.
const TIME_EPSILON = 1e-6;

export type MatchEvent = 'questionStarted' | 'zonesAppeared' | 'meteorStarted' | 'questionJudged' | 'finalStarted';

export function createLobbyMatch(): MatchState {
  return {
    phase: 'lobby',
    phaseElapsed: 0,
    phaseDuration: 0,
    questions: [],
    questionIndex: -1,
    zones: [],
    isZonesVisible: false,
    meteorStartElapsed: null,
  };
}

export function startMatch(match: MatchState, questions: QuizQuestion[], config: GameConfig): void {
  if (questions.length === 0) {
    throw new Error('문제가 없어 게임을 시작할 수 없습니다.');
  }
  Object.assign(match, createLobbyMatch(), { questions });
  enterPhase(match, 'intro', config.timeline.introBrawlSeconds);
}

export function returnToLobby(match: MatchState): void {
  Object.assign(match, createLobbyMatch());
}

export function getCurrentQuestion(match: MatchState): QuizQuestion | undefined {
  return match.questions[match.questionIndex];
}

export function getPhaseRemaining(match: MatchState): number {
  return Math.max(0, match.phaseDuration - match.phaseElapsed);
}

// 진행 흐름: 자유 난투 → (문제 → 구역 생성 → 판정 → 사이 난투) × 문제 수 → 최종 순위
// 최종 순위 화면은 관리자가 새 게임을 누를 때까지 계속 유지한다(returnToLobby).
export function advanceMatch(match: MatchState, deltaSeconds: number, config: GameConfig, random: RandomSource): MatchEvent[] {
  if (match.phase === 'lobby' || match.phase === 'final') {
    return [];
  }
  const events: MatchEvent[] = [];
  match.phaseElapsed += deltaSeconds;
  if (match.phase === 'question' && !match.isZonesVisible && match.phaseElapsed + TIME_EPSILON >= config.timeline.zoneAppearDelaySeconds) {
    showZones(match, config, random);
    events.push('zonesAppeared');
  }
  if (match.phase === 'question' && match.meteorStartElapsed !== null && match.phaseElapsed + TIME_EPSILON >= match.meteorStartElapsed) {
    match.meteorStartElapsed = null;
    events.push('meteorStarted');
  }
  if (match.phaseElapsed + TIME_EPSILON >= match.phaseDuration) {
    events.push(...finishPhase(match, config, random));
  }
  return events;
}

function finishPhase(match: MatchState, config: GameConfig, random: RandomSource): MatchEvent[] {
  switch (match.phase) {
    case 'intro':
      beginQuestion(match, 0, config, random);
      return ['questionStarted'];
    case 'question':
      return finishQuestion(match, config, random);
    case 'between':
      if (match.questionIndex + 1 < match.questions.length) {
        beginQuestion(match, match.questionIndex + 1, config, random);
        return ['questionStarted'];
      }
      enterPhase(match, 'final', 0);
      return ['finalStarted'];
    default:
      return [];
  }
}

// 구역 생성 지연이 카운트다운보다 길게 설정돼도, 판정 전에 구역은 반드시 만든다.
function finishQuestion(match: MatchState, config: GameConfig, random: RandomSource): MatchEvent[] {
  const events: MatchEvent[] = [];
  if (!match.isZonesVisible) {
    showZones(match, config, random);
    events.push('zonesAppeared');
  }
  const isLastQuestion = match.questionIndex >= match.questions.length - 1;
  enterPhase(match, 'between', isLastQuestion ? config.timeline.finalRevealDelaySeconds : config.timeline.betweenBrawlSeconds);
  events.push('questionJudged');
  return events;
}

function beginQuestion(match: MatchState, questionIndex: number, config: GameConfig, random: RandomSource): void {
  const question = match.questions[questionIndex] as QuizQuestion;
  const countdownSeconds = getCountdownSeconds(question, config);
  match.questionIndex = questionIndex;
  match.zones = [];
  match.isZonesVisible = false;
  match.meteorStartElapsed = pickMeteorStartElapsed(countdownSeconds, config, random);
  enterPhase(match, 'question', countdownSeconds);
}

// 판정까지 남은 시간이 min~max초일 때 떨어지도록 경고 시작 시각을 고른다. 맞은 사람이 판정 전에 돌아올 시간을 남기기 위해서다.
// 경고는 정답 구역이 나온 뒤에 시작한다. 문제 시간이 짧으면 그만큼 착지를 판정 쪽으로 당기고, min초도 남길 수 없으면 내지 않는다.
function pickMeteorStartElapsed(countdownSeconds: number, config: GameConfig, random: RandomSource): number | null {
  const { minLandRemainingSeconds, maxLandRemainingSeconds, warningSeconds } = config.meteor;
  const latestLandRemaining = Math.min(maxLandRemainingSeconds, countdownSeconds - warningSeconds - config.timeline.zoneAppearDelaySeconds);
  if (latestLandRemaining < minLandRemainingSeconds) {
    return null;
  }
  const landRemaining = minLandRemainingSeconds + random() * (latestLandRemaining - minLandRemainingSeconds);
  return countdownSeconds - landRemaining - warningSeconds;
}

function showZones(match: MatchState, config: GameConfig, random: RandomSource): void {
  const question = getCurrentQuestion(match);
  match.zones = question ? placeAnswerZones(question, config, random) : [];
  match.isZonesVisible = true;
}

function enterPhase(match: MatchState, phase: GamePhase, durationSeconds: number): void {
  match.phase = phase;
  match.phaseElapsed = 0;
  match.phaseDuration = durationSeconds;
}
