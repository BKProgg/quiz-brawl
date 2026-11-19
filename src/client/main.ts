import type { PlayerSnapshot, ServerMessage } from '../game/protocol-types';
import type { CharacterPose } from './asset-store';

import { GAME_CONFIG } from '../game/game-config';
import { isSolidState } from '../game/movement-physics';
import { AssetStore } from './asset-store';
import { CanvasViewport } from './canvas-viewport';
import { CharacterPickerView } from './character-picker-view';
import { drawCharacterPreview } from './character-renderer';
import { applyServerMessage, createClientState } from './client-state';
import { EffectsManager } from './effects-renderer';
import { KeyboardInput } from './keyboard-input';
import { NetworkClient } from './network-client';
import { OwnPlayerPredictor } from './own-player-predictor';
import { PlayerConnection } from './player-connection';
import { SceneRenderer } from './scene-renderer';
import { forgetSession, rememberSession } from './session-memory';
import { TutorialView } from './tutorial-view';

const MAXIMUM_FRAME_SECONDS = 0.1;
// 내가 직접 한 동작(공격·아이템 던지기)은 예측을 끄지 않는다. 그 외에는 서버 상태를 따른다.
// 사람을 들고 있을 때도 예측을 끈다. 들린 사람은 서버 위치로 그려지므로, 내 캐릭터만 앞서가면 머리 위에서 어긋나 보인다.
const SELF_CONTROLLED_STATES = new Set(['free', 'punching', 'kicking', 'tossing']);

function findObstacles(players: PlayerSnapshot[], playerId: string | null) {
  return players.filter((player) => player.id !== playerId && isSolidState(player.state)).map((player) => ({ x: player.x, y: player.y }));
}

async function startGame(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const viewport = new CanvasViewport(canvas, GAME_CONFIG.arena.width, GAME_CONFIG.arena.height);
  const assets = new AssetStore();
  await assets.load();
  let state = createClientState();
  const network = new NetworkClient();
  let predictor = new OwnPlayerPredictor();
  const effects = new EffectsManager();
  const sceneRenderer = new SceneRenderer();
  let lastActionCounts = { punchCount: 0, kickCount: 0 };
  let localAction: { pose: 'punch' | 'kick'; endsAt: number } | null = null;
  let lastRenderedPhase = state.phase;

  const keyboard = new KeyboardInput(() => {
    const input = keyboard.getInput();
    if (input.punchCount !== lastActionCounts.punchCount || input.kickCount !== lastActionCounts.kickCount) {
      const now = performance.now();
      const isKick = input.kickCount !== lastActionCounts.kickCount;
      const config = state.config ?? GAME_CONFIG;
      if (predictor.getPosition() !== null && !input.isBlockPressed) {
        localAction = { pose: isKick ? 'kick' : 'punch', endsAt: now + config[isKick ? 'kick' : 'punch'].durationSeconds * 1000 };
      }
      predictor.pauseForAction(now, network.getRoundTripMilliseconds(), input.isBlockPressed);
      lastActionCounts = { punchCount: input.punchCount, kickCount: input.kickCount };
    }
    if (state.playerId !== null) {
      network.send({ type: 'input', ...input });
    }
  });
  const picker = new CharacterPickerView(
    (previewCanvas, colorIndex) => drawCharacterPreview(previewCanvas, assets, colorIndex),
    (nickname, colorIndex) => network.send({ type: 'join', nickname, colorIndex }),
  );
  const tutorial = new TutorialView();
  const renderOverlays = (): void => {
    picker.render(state);
    if (state.phase !== 'lobby') {
      tutorial.hide();
    }
  };

  const handleSnapshot = (message: Extract<ServerMessage, { type: 'snapshot' }>, now: number): void => {
    state.oneWayLatencySeconds = network.getRoundTripMilliseconds() / 2000;
    const own = message.players.find((player) => player.id === state.playerId);
    if (own) {
      const displayed = state.interpolator.getView(now).players.find((player) => player.id === own.id) ?? own;
      predictor.reconcile(own, SELF_CONTROLLED_STATES.has(own.state), network.getRoundTripMilliseconds(), now, displayed);
    }
    effects.observePlayers(message.players, state.playerId, now);
    effects.observeJudgement(state.judgement, message.players, (state.config ?? GAME_CONFIG).scoring.pointsPerCorrect, now);
  };

  // 화면 위 DOM(캐릭터 선택·대기실)은 스냅샷마다 다시 그리지 않고, 명단·입장·단계가 바뀔 때만 갱신한다.
  const handleMessage = (message: ServerMessage): void => {
    const now = performance.now();
    applyServerMessage(state, message, now);
    if (message.type === 'snapshot') {
      handleSnapshot(message, now);
    } else if (message.type === 'welcome') {
      rememberSession({ playerId: message.playerId, resumeToken: message.resumeToken });
      network.send({ type: 'input', ...keyboard.getInput() });
      if (!connection.takeResumeFlag()) {
        tutorial.show();
      }
    } else if (message.type === 'rejected') {
      // 복귀가 거절되면(유예 만료, 또는 저장된 값이 깨짐) 기억한 자리를 버리고 다시 고르게 한다.
      const isResumeRejected = message.reason === 'resumeExpired' || message.reason === 'invalidJoin';
      if (isResumeRejected && connection.takeResumeFlag()) {
        forgetSession();
        picker.showRejection('resumeExpired');
      } else {
        picker.showRejection(message.reason);
      }
    }
    if (message.type !== 'snapshot' || state.phase !== lastRenderedPhase) {
      lastRenderedPhase = state.phase;
      renderOverlays();
    }
  };

  // 끊기면 상태를 비운다. "방이 가득 찼습니다"처럼 서버가 끊기 직전에 보낸 안내는 그대로 남긴다.
  const connection = new PlayerConnection(network, picker, {
    onMessage: handleMessage,
    onConnected: renderOverlays,
    onDisconnected: () => {
      const info = { shouldKeepMessage: state.rejectReason === 'roomFull' };
      state = createClientState();
      predictor = new OwnPlayerPredictor();
      effects.reset();
      sceneRenderer.reset();
      renderOverlays();
      return info;
    },
  });

  renderOverlays();
  connection.start();

  // 서버에서 자유 상태(예측 중)일 때만 내 입력을 바로 자세로 보여 준다. 맞거나 잡히면 서버 상태를 따른다.
  const resolveSelfPose = (now: number): CharacterPose | null => {
    if (predictor.getPosition() === null) {
      return null;
    }
    if (localAction !== null && now < localAction.endsAt) {
      return localAction.pose;
    }
    return keyboard.getInput().isBlockPressed ? 'block' : null;
  };

  let lastFrameAt = performance.now();
  // 다음 프레임을 먼저 예약한다. 그리는 도중 예외가 나도 화면이 그대로 멈추지 않는다.
  const renderFrame = (now: number): void => {
    requestAnimationFrame(renderFrame);
    const deltaSeconds = Math.min(MAXIMUM_FRAME_SECONDS, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    const config = state.config ?? GAME_CONFIG;
    const view = state.interpolator.getView(now);
    // 메테오는 화면에 그려지는 시점(보간 지연 뒤)에 맞춰 흔들어야 땅에 닿는 순간과 어긋나지 않는다.
    effects.observeMeteors(view.meteors, now);
    const obstacles = findObstacles(view.players, state.playerId);
    predictor.advance(now, deltaSeconds, keyboard.getInput(), obstacles, config);
    viewport.beginFrame();
    sceneRenderer.render({ ctx: viewport.context, state, config, assets, effects, predictor, now, selfPoseOverride: resolveSelfPose(now) });
  };
  requestAnimationFrame(renderFrame);
}

startGame().catch((error: unknown) => {
  const message = document.getElementById('picker-message');
  if (message) {
    message.textContent = '게임을 불러오지 못했습니다. 새로고침해 주세요.';
  }
  console.error(error);
});
