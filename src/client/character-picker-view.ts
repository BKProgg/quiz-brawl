import type { RejectReason } from '../game/protocol-types';
import type { ClientGameState } from './client-state';

import { CHARACTER_PALETTE } from '../game/character-palette';
import { queryElement } from './dom-helpers';

const PREVIEW_WIDTH = 96;
const PREVIEW_HEIGHT = 110;

const REJECT_MESSAGES: Record<RejectReason, string> = {
  roomFull: '방이 가득 찼습니다. (최대 10명) 자리가 나면 새로고침해 주세요.',
  colorTaken: '다른 사람이 먼저 골랐어요. 다른 캐릭터를 골라 주세요.',
  resumeExpired: '이전 자리가 사라졌습니다. 닉네임과 캐릭터를 다시 골라 주세요.',
  invalidNickname: '닉네임을 입력해 주세요.',
  invalidJoin: '입장 요청이 잘못되었습니다. 새로고침해 주세요.',
};

// 주소로 들어오면 가장 먼저 보이는 캐릭터 선택 화면. 고르면 바로 입장한다.
export class CharacterPickerView {
  private readonly panel = queryElement<HTMLElement>('#character-picker');
  private readonly grid = queryElement<HTMLElement>('#character-grid');
  private readonly message = queryElement<HTMLParagraphElement>('#picker-message');
  private readonly nicknameInput = queryElement<HTMLInputElement>('#nickname-input');
  private readonly buttons: HTMLButtonElement[];
  private isWaitingForAnswer = false;
  private isConnected = false;

  constructor(drawPreview: (canvas: HTMLCanvasElement, colorIndex: number) => void, onPick: (nickname: string, colorIndex: number) => void) {
    this.buttons = CHARACTER_PALETTE.map((color, colorIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-tile';
      button.setAttribute('aria-label', `${color.name} 캐릭터`);
      const canvas = document.createElement('canvas');
      canvas.width = PREVIEW_WIDTH;
      canvas.height = PREVIEW_HEIGHT;
      drawPreview(canvas, colorIndex);
      const name = document.createElement('span');
      name.className = 'tile-name';
      name.textContent = color.name;
      const status = document.createElement('span');
      status.className = 'tile-status';
      button.append(canvas, name, status);
      button.addEventListener('click', () => {
        const nickname = this.nicknameInput.value.trim();
        if (nickname === '') {
          this.message.textContent = REJECT_MESSAGES.invalidNickname;
          this.nicknameInput.focus();
          return;
        }
        this.isWaitingForAnswer = true;
        this.message.textContent = '입장하는 중…';
        this.buttons.forEach((other) => {
          other.disabled = true;
        });
        onPick(nickname, colorIndex);
      });
      return button;
    });
    this.grid.replaceChildren(...this.buttons);
  }

  showMessage(text: string): void {
    this.message.textContent = text;
  }

  // 입장 요청의 답을 기다리다 끊기면 그 대기 상태도 푼다. 다시 붙었을 때 버튼이 잠긴 채 남지 않게 한다.
  setConnected(isConnected: boolean): void {
    this.isConnected = isConnected;
    if (!isConnected) {
      this.isWaitingForAnswer = false;
    }
  }

  // 색이 이미 사용 중이면 다시 고를 수 있게 풀어 준다. 그 밖의 거절은 연결이 끊긴다.
  showRejection(reason: RejectReason): void {
    this.isWaitingForAnswer = false;
    this.message.textContent = REJECT_MESSAGES[reason];
  }

  // 입장이 끝나면 "입장하는 중" 상태를 풀어 둔다. 관리자가 방을 초기화해 다시 선택 화면으로 돌아왔을 때 바로 고를 수 있어야 한다.
  render(state: ClientGameState): void {
    this.panel.hidden = state.playerId !== null;
    if (state.playerId !== null) {
      this.isWaitingForAnswer = false;
      this.nicknameInput.blur();
      return;
    }
    const usedColors = new Set([...state.roster.values()].map((player) => player.colorIndex));
    this.buttons.forEach((button, colorIndex) => {
      const isUsed = usedColors.has(colorIndex);
      button.disabled = isUsed || this.isWaitingForAnswer || !this.isConnected;
      button.classList.toggle('is-used', isUsed);
      const status = button.querySelector('.tile-status');
      if (status) {
        status.textContent = isUsed ? '사용 중' : '';
      }
    });
  }
}
