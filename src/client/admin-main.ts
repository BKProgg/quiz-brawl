import type { ServerMessage } from '../game/protocol-types';

import { GAME_CONFIG } from '../game/game-config';
import { AdminPanelView } from './admin-panel-view';
import { AssetStore } from './asset-store';
import { CanvasViewport } from './canvas-viewport';
import { applyServerMessage, createClientState } from './client-state';
import { EffectsManager } from './effects-renderer';
import { NetworkClient } from './network-client';
import { OwnPlayerPredictor } from './own-player-predictor';
import { SceneRenderer } from './scene-renderer';

const RECONNECT_INTERVAL_MILLISECONDS = 2000;

// 관리자 화면: 경기장 전체를 관전하고(큰 화면에 띄우기 좋음), 대기 중일 때 게임을 시작한다.
async function startAdmin(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const viewport = new CanvasViewport(canvas, GAME_CONFIG.arena.width, GAME_CONFIG.arena.height);
  const assets = new AssetStore();
  await assets.load();
  const state = createClientState();
  const network = new NetworkClient();
  const predictor = new OwnPlayerPredictor();
  const effects = new EffectsManager();
  const sceneRenderer = new SceneRenderer();
  let isConnected = false;
  let lastRenderedPhase = state.phase;
  const panel = new AdminPanelView(() => network.send({ type: 'start' }), () => network.send({ type: 'newGame' }));

  const handleMessage = (message: ServerMessage): void => {
    const now = performance.now();
    applyServerMessage(state, message, now);
    if (message.type === 'snapshot') {
      state.oneWayLatencySeconds = network.getRoundTripMilliseconds() / 2000;
      effects.observePlayers(message.players, null, now);
      effects.observeJudgement(state.judgement, message.players, (state.config ?? GAME_CONFIG).scoring.pointsPerCorrect, now);
    }
    if (message.type !== 'snapshot' || state.phase !== lastRenderedPhase) {
      lastRenderedPhase = state.phase;
      panel.render(state, isConnected);
    }
  };

  // 관리자 화면은 보통 큰 화면에 띄워 두므로, 끊기면 붙을 때까지 계속 다시 시도한다.
  // 실패한 연결은 error와 close가 둘 다 오므로, 예약은 한 번에 하나만 둔다.
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleReconnect = (): void => {
    if (reconnectTimer === null) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, RECONNECT_INTERVAL_MILLISECONDS);
    }
  };

  const connect = (): void => {
    network.connect(handleMessage, handleClose)
      .then(() => {
        isConnected = true;
        panel.showMessage('');
        network.send({ type: 'adminJoin' });
      })
      .catch(scheduleReconnect);
  };

  const handleClose = (): void => {
    isConnected = false;
    effects.reset();
    sceneRenderer.reset();
    panel.showMessage('연결이 끊겨 다시 붙는 중…');
    panel.render(state, isConnected);
    scheduleReconnect();
  };

  connect();

  // 다음 프레임을 먼저 예약한다. 그리는 도중 예외가 나도 화면이 그대로 멈추지 않는다.
  const renderFrame = (now: number): void => {
    requestAnimationFrame(renderFrame);
    effects.observeMeteors(state.interpolator.getView(now).meteors, now);
    viewport.beginFrame();
    const config = state.config ?? GAME_CONFIG;
    sceneRenderer.render({ ctx: viewport.context, state, config, assets, effects, predictor, now, selfPoseOverride: null });
  };
  requestAnimationFrame(renderFrame);
}

startAdmin().catch((error: unknown) => {
  const message = document.getElementById('admin-message');
  if (message) {
    message.textContent = '관리자 화면을 불러오지 못했습니다. 새로고침해 주세요.';
  }
  console.error(error);
});
