import type { GamePhase } from '../game/game-types';
import type { ClientGameState } from './client-state';

import { getCharacterColorHex } from '../game/character-palette';
import { queryElement } from './dom-helpers';

const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: '대기 중 · 참가자들이 자유롭게 놀고 있습니다',
  intro: '시작! 곧 첫 문제가 나옵니다',
  question: '문제 진행 중',
  between: '정답 공개 · 다음 문제 준비 중',
  final: '최종 결과 화면 · 새 게임을 누르면 전원 내보내고 처음부터 시작합니다',
};
const ABORT_CONFIRM_MESSAGE = '진행 중인 게임을 중단하고 전원을 내보냅니다. 모두 닉네임과 캐릭터를 다시 고르게 됩니다. 계속할까요?';
const NEW_GAME_CONFIRM_MESSAGE = '전원을 내보내고 처음부터 다시 시작합니다. 모두 닉네임과 캐릭터를 다시 고르게 됩니다. 계속할까요?';

// 관리자 화면 패널. 참가자 목록과 진행 상태를 보여 주고, 대기 중일 때는 게임 시작, 최종 결과 화면에서는 새 게임 버튼을 켠다.
export class AdminPanelView {
  private readonly status = queryElement<HTMLParagraphElement>('#admin-status');
  private readonly playerCount = queryElement<HTMLElement>('#admin-player-count');
  private readonly playerList = queryElement<HTMLUListElement>('#admin-player-list');
  private readonly startButton = queryElement<HTMLButtonElement>('#admin-start-button');
  private readonly message = queryElement<HTMLParagraphElement>('#admin-message');
  private readonly panel = queryElement<HTMLElement>('#admin-panel');
  private readonly newGameButton = queryElement<HTMLButtonElement>('#admin-new-game-button');
  private isFinal = false;

  constructor(onStart: () => void, onNewGame: () => void) {
    this.startButton.addEventListener('click', () => {
      this.startButton.disabled = true;
      onStart();
    });
    // 새 게임·중단 모두 전원을 내보내므로 실수로 누르지 않게 한 번 더 묻는다.
    this.newGameButton.addEventListener('click', () => {
      if (!window.confirm(this.isFinal ? NEW_GAME_CONFIRM_MESSAGE : ABORT_CONFIRM_MESSAGE)) {
        return;
      }
      this.newGameButton.disabled = true;
      onNewGame();
    });
  }

  showMessage(text: string): void {
    this.message.textContent = text;
  }

  render(state: ClientGameState, isConnected: boolean): void {
    const players = [...state.roster.values()];
    const playingCount = players.filter((player) => player.isInWorld).length;
    this.status.textContent = isConnected && state.config ? PHASE_LABELS[state.phase] : '연결되지 않음';
    this.playerCount.textContent = String(players.length);
    const isRunning = state.phase !== 'lobby';
    this.isFinal = state.phase === 'final';
    this.panel.classList.toggle('is-compact', isRunning && !this.isFinal);
    this.panel.classList.toggle('is-final', this.isFinal);
    this.startButton.hidden = isRunning;
    this.newGameButton.hidden = !isRunning;
    this.newGameButton.textContent = this.isFinal ? '새 게임' : '게임 중단';
    this.newGameButton.classList.toggle('is-danger', !this.isFinal);
    this.newGameButton.disabled = !isConnected;
    this.startButton.disabled = !isConnected || state.config === null || state.phase !== 'lobby' || playingCount === 0;
    const items = players.map((player) => {
      const item = document.createElement('li');
      const colorDot = document.createElement('span');
      colorDot.className = 'color-dot';
      colorDot.style.background = getCharacterColorHex(player.colorIndex);
      const name = document.createElement('span');
      name.textContent = player.isInWorld ? player.nickname : `${player.nickname} (다음 판 대기)`;
      item.append(colorDot, name);
      return item;
    });
    this.playerList.replaceChildren(...items);
  }
}
