export interface Vector {
  x: number;
  y: number;
}

export type RandomSource = () => number;

export type PlayerState = 'free' | 'punching' | 'kicking' | 'lifting' | 'tossing' | 'stunned' | 'grabbed' | 'airborne' | 'down';

export interface PlayerInput {
  isUpPressed: boolean;
  isDownPressed: boolean;
  isLeftPressed: boolean;
  isRightPressed: boolean;
  isBlockPressed: boolean;
  punchCount: number;
  kickCount: number;
}

export interface PlayerEntity {
  id: string;
  nickname: string;
  colorIndex: number;
  position: Vector;
  knockback: Vector;
  facing: Vector;
  facingSign: 1 | -1;
  state: PlayerState;
  stateElapsed: number;
  stateDuration: number;
  // 착지 후 쓰러져 있을 시간. null이면 기본값(down.durationSeconds)을 쓴다.
  landingDownSeconds: number | null;
  hasAttackResolved: boolean;
  isBlocking: boolean;
  recentHitTimes: number[];
  invincibleRemaining: number;
  heldItemId: string | null;
  grabbedTargetId: string | null;
  grabbedById: string | null;
  score: number;
  input: PlayerInput;
  handledPunchCount: number;
  handledKickCount: number;
}

export type ItemState = 'floor' | 'held' | 'flying';

export interface ItemEntity {
  id: string;
  kind: number;
  position: Vector;
  state: ItemState;
  holderId: string | null;
  velocity: Vector;
  thrownById: string | null;
  travelledDistance: number;
}

export type LogState = 'warning' | 'rolling';

export interface LogEntity {
  id: string;
  x: number;
  y: number;
  direction: 1 | -1;
  state: LogState;
  warningElapsed: number;
}

export type MeteorState = 'warning' | 'impact';

export interface MeteorEntity {
  id: string;
  x: number;
  y: number;
  state: MeteorState;
  stateElapsed: number;
}

export interface WorldState {
  time: number;
  players: Map<string, PlayerEntity>;
  items: Map<string, ItemEntity>;
  nextItemNumber: number;
  itemSpawnElapsed: number;
  logs: Map<string, LogEntity>;
  nextLogNumber: number;
  logSpawnRemaining: number;
  meteors: Map<string, MeteorEntity>;
  nextMeteorNumber: number;
}

export type GamePhase = 'lobby' | 'intro' | 'question' | 'between' | 'final';

export type QuestionType = 'OX' | 'CHOICE4';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  text: string;
  choices?: string[];
  answerIndex: number;
  countdownSeconds?: number;
}

export interface PublicQuestion {
  index: number;
  total: number;
  type: QuestionType;
  text: string;
  choices: string[];
  countdownSeconds: number;
}

export interface AnswerZone {
  choiceIndex: number;
  label: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MatchState {
  phase: GamePhase;
  phaseElapsed: number;
  phaseDuration: number;
  questions: QuizQuestion[];
  questionIndex: number;
  zones: AnswerZone[];
  isZonesVisible: boolean;
  // 이번 문제에서 메테오 경고가 시작될 시각(문제 시작 기준 초). 이미 나왔거나 문제가 너무 짧으면 null.
  meteorStartElapsed: number | null;
}

export interface RankingEntry {
  playerId: string;
  nickname: string;
  colorIndex: number;
  score: number;
  rank: number;
}
