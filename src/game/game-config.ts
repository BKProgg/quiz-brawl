// 게임의 모든 조정 가능한 수치. 시간·문제 수·전투 수치는 여기만 바꾸면 된다.
export const GAME_CONFIG = {
  maxPlayers: 10, // 캐릭터 색(12개)보다 많으면 안 된다.
  serverTickRate: 30,
  snapshotRate: 20,
  arena: { width: 1600, height: 900, left: 150, right: 1450, top: 185, bottom: 780 },
  timeline: {
    // 관리자가 시작을 누른 뒤 첫 문제가 나오기까지의 시간. 대기실에서 이미 자유 난투를 하고 있으므로 짧게 둔다.
    introBrawlSeconds: 5,
    questionCount: 6,
    answerCountdownSeconds: 30,
    zoneAppearDelaySeconds: 3,
    betweenBrawlSeconds: 10,
    finalRevealDelaySeconds: 3,
  },
  scoring: { pointsPerCorrect: 100 },
  player: { radius: 26, moveSpeed: 260, blockMoveSpeedRatio: 0.4, knockbackFriction: 6 },
  // 공격 자세는 타격 직후 바로 풀린다(버튼을 떼면 곧바로 원래 자세).
  punch: { durationSeconds: 0.15, hitTimeSeconds: 0.08, range: 42, hitRadius: 26, knockbackSpeed: 380, stunSeconds: 0.3 },
  kick: { durationSeconds: 0.3, hitTimeSeconds: 0.18, range: 60, hitRadius: 30, knockbackSpeed: 650, stunSeconds: 0.45, missRecoverySeconds: 0.12 },
  block: { pushbackSpeed: 200 },
  // 잡으면 머리 위로 든다. 드는 동안 느리게 걷고 방향을 바꿀 수 있고, 다시 Z를 누르면 바라보는 방향으로 던진다.
  // holdSeconds 안에 던지지 않으면 들린 사람이 빠져나온다. 풀려난 사람은 잠깐 무적이라 바로 다시 잡히거나 맞지 않는다.
  throwing: {
    contactDistance: 64,
    directionDotThreshold: 0.5,
    holdSeconds: 1.5,
    minHoldSeconds: 0.15,
    holdMoveSpeedRatio: 0.4,
    releaseInvincibleSeconds: 1,
    airborneSeconds: 0.45,
    airborneSpeed: 700,
  },
  down: { hitCount: 3, hitWindowSeconds: 1.5, durationSeconds: 1.0, invincibleSeconds: 1.0 },
  // 굴러오는 통나무: 좌우 벽 밖에서 나와 반대편까지 가로지른다. 맞으면 통나무 방향으로 날아가 쓰러진다.
  log: { minIntervalSeconds: 10, maxIntervalSeconds: 20, warningSeconds: 1, radius: 40, halfLength: 135, speed: 330, launchSpeed: 760 },
  // 메테오: 문제마다 판정 5~8초 전에 한 번 떨어진다. 2초 경고 뒤 착지하면 범위 안의 캐릭터가 중심 반대 방향으로 날아가 1.5초 쓰러진다.
  meteor: {
    warningSeconds: 2,
    impactSeconds: 0.6,
    radius: 350,
    launchSpeed: 760,
    downSeconds: 1.5,
    minLandRemainingSeconds: 5,
    maxLandRemainingSeconds: 8,
  },
  // 물건에 맞거나 연타로 다운될 때: 맞은 반대 방향으로 붕 날아간 뒤 자빠진다.
  knockdownLaunch: { speed: 540, airborneSeconds: 0.35 },
  item: {
    initialCount: 6,
    maxOnFloor: 8,
    respawnSeconds: 4,
    pickupDistance: 40,
    radius: 16,
    throwSpeed: 900,
    throwMaxDistance: 700,
    tossSeconds: 0.2,
    kindCount: 6,
  },
  // 정답 구역은 경기장을 칸으로 나눠 꽉 채운다. gap은 구역 사이 통로 너비.
  zone: { gap: 40 },
  network: {
    // 키를 누르고 뗄 때마다 입력이 한 번씩 오므로, 여러 키를 마구 두드려도 닿지 않을 만큼 넉넉히 둔다. 넘으면 연결을 끊는다.
    maxMessagesPerSecond: 120,
    // 캐릭터 선택 화면에 머무는 시간을 넉넉히 둔다. 그 안에 입장하지 않으면 연결을 끊는다.
    joinTimeoutSeconds: 120,
    // 닉네임 최대 글자 수(한글 기준, 코드포인트 수)
    nicknameMaxLength: 5,
    // 게임 중 끊긴 사람이 같은 캐릭터·점수로 돌아올 수 있는 시간
    reconnectGraceSeconds: 15,
    // 이 시간 동안 아무 소식(2초 간격 핑 포함)이 없는 연결은 서버가 끊는다. 절전에서 잠깐 깨어난 사람이 그대로 이어 하도록 넉넉히 둔다.
    silenceTimeoutSeconds: 70,
    // 그보다 훨씬 먼저, 이 시간 동안 소식이 없으면 누르고 있던 키를 뗀 것으로 본다(조용히 끊긴 사람의 캐릭터가 혼자 달리지 않게).
    // 브라우저는 8초 무응답이면 스스로 다시 붙으므로 그보다 길게 둔다.
    keyReleaseSilenceSeconds: 10,
    maxPendingSessions: 20,
  },
} as const;

export type GameConfig = typeof GAME_CONFIG;
