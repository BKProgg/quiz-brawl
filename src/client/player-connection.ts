import type { ServerMessage } from '../game/protocol-types';
import type { CharacterPickerView } from './character-picker-view';
import type { NetworkClient } from './network-client';

import { JOIN_TIMEOUT_CLOSE_REASON, REPLACED_CLOSE_REASON, ROOM_RESET_CLOSE_REASON } from '../game/protocol-types';
import { forgetSession, recallSession } from './session-memory';

// 서버는 15초 동안 자리를 남겨 두므로, 그보다 길게(18초) 다시 붙어 본다.
const RECONNECT_ATTEMPTS = 12;
const RECONNECT_INTERVAL_MILLISECONDS = 1500;
// 선택 화면에 오래 머물러 끊긴 뒤, 사람이 돌아왔다고 볼 수 있는 사건들
const WAKE_EVENTS = ['pointerdown', 'keydown', 'focus', 'visibilitychange'];
const JOIN_TIMEOUT_MESSAGE = '오래 기다려 연결을 잠시 쉬었습니다. 화면을 누르면 다시 연결됩니다.';
const CONNECTING_MESSAGE = '연결하는 중…';
const RECONNECTING_MESSAGE = '연결이 끊겨 다시 붙는 중…';
const ROOM_RESET_MESSAGE = '관리자가 게임을 처음부터 다시 시작합니다. 닉네임과 캐릭터를 다시 골라 주세요.';
const CONNECT_FAILED_MESSAGE = '서버에 연결하지 못했습니다. 화면을 누르면 다시 시도합니다. 계속 안 되면 새로고침해 주세요.';

export interface DisconnectInfo {
  shouldKeepMessage: boolean;
}

export interface ConnectionHooks {
  onMessage(message: ServerMessage): void;
  onConnected(): void;
  // 상태를 초기화하고, 끊기기 전 상황을 알려 준다.
  onDisconnected(): DisconnectInfo;
}

// 플레이어 화면의 접속·복귀·자동 재접속을 맡는다. 죽은 연결의 감지는 NetworkClient가 한다.
export class PlayerConnection {
  private isReconnecting = false;
  private isResuming = false;

  constructor(
    private readonly network: NetworkClient,
    private readonly picker: CharacterPickerView,
    private readonly hooks: ConnectionHooks,
  ) {}

  // 처음 접속도 재접속과 같은 방식으로 여러 번 시도한다. 한 번의 실패로 화면이 멈추지 않게 한다.
  start(): void {
    this.reconnect(0, CONNECTING_MESSAGE);
  }

  // 복귀 시도로 들어온 입장인지 돌려주고 표시를 지운다. 복귀면 튜토리얼을 다시 띄우지 않는다.
  takeResumeFlag(): boolean {
    const hasBeenResuming = this.isResuming;
    this.isResuming = false;
    return hasBeenResuming;
  }

  // 연결되면 기억해 둔 자리가 있을 때 먼저 복귀를 시도한다. 없거나 유예가 지났으면 캐릭터 선택 화면이 뜬다.
  private connect(connectedMessage: string): Promise<void> {
    return this.network.connect((message) => this.hooks.onMessage(message), (reason) => this.handleClose(reason)).then(() => {
      this.isReconnecting = false;
      this.picker.setConnected(true);
      this.picker.showMessage(connectedMessage);
      const remembered = recallSession();
      if (remembered !== null) {
        this.isResuming = true;
        this.network.send({ type: 'resume', ...remembered });
      }
      this.hooks.onConnected();
    });
  }

  // 끊기면 자동으로 다시 붙는다. 게임 중이면 같은 자리로 복귀하고, 캐릭터 선택 화면이었으면 다시 고를 수 있게 한다.
  // 재접속 시도 중에 실패한 연결의 close는 안내 문구를 덮어쓰지 않게 무시한다.
  // 다른 탭이 같은 자리로 들어왔거나 방이 가득 차서 끊긴 경우에는 다시 붙지 않는다.
  private handleClose(reason: string): void {
    console.info(`[connection] closed (${reason || 'no reason'})`);
    if (this.isReconnecting) {
      return;
    }
    this.picker.setConnected(false);
    const { shouldKeepMessage } = this.hooks.onDisconnected();
    if (reason === REPLACED_CLOSE_REASON) {
      forgetSession();
      this.picker.showMessage('다른 탭에서 같은 자리로 들어와 이 탭은 끊겼습니다. 새로고침하면 다시 고를 수 있습니다.');
      return;
    }
    // 관리자가 방을 처음 상태로 되돌리면 자리를 잊고 바로 다시 붙어 닉네임·캐릭터 선택부터 시작한다.
    if (reason === ROOM_RESET_CLOSE_REASON) {
      forgetSession();
      this.reconnect(0, RECONNECTING_MESSAGE, ROOM_RESET_MESSAGE);
      return;
    }
    // 선택 화면에 오래 머물러 끊긴 탭은 바로 다시 붙지 않는다(열어만 둔 탭이 서버를 계속 깨워 두지 않게). 사람이 돌아오면 붙는다.
    if (reason === JOIN_TIMEOUT_CLOSE_REASON) {
      this.picker.showMessage(JOIN_TIMEOUT_MESSAGE);
      this.reconnectWhenAwake();
      return;
    }
    if (shouldKeepMessage) {
      return;
    }
    this.reconnect(RECONNECT_INTERVAL_MILLISECONDS);
  }

  private reconnectWhenAwake(): void {
    const wake = (): void => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      WAKE_EVENTS.forEach((eventName) => window.removeEventListener(eventName, wake));
      this.reconnect(0);
    };
    WAKE_EVENTS.forEach((eventName) => window.addEventListener(eventName, wake));
  }

  // 정해진 횟수만큼 다시 붙어 본다. 다 실패하면 사람이 화면을 만지거나 탭을 다시 볼 때 한 번 더 시도한다(네트워크가 늦게 돌아온 경우).
  private reconnect(firstDelayMilliseconds: number, waitingMessage = RECONNECTING_MESSAGE, connectedMessage = ''): void {
    this.isReconnecting = true;
    this.picker.showMessage(waitingMessage);
    let attemptsLeft = RECONNECT_ATTEMPTS;
    const retry = (): void => {
      attemptsLeft -= 1;
      this.connect(connectedMessage).catch(() => {
        if (attemptsLeft > 0) {
          setTimeout(retry, RECONNECT_INTERVAL_MILLISECONDS);
        } else {
          this.isReconnecting = false;
          this.picker.showMessage(CONNECT_FAILED_MESSAGE);
          this.reconnectWhenAwake();
        }
      });
    };
    setTimeout(retry, firstDelayMilliseconds);
  }
}
