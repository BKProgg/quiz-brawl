import type { PlayerInput } from '../game/game-types';

import { createEmptyInput } from '../game/player-factory';

const DIRECTION_KEYS: Record<string, keyof Pick<PlayerInput, 'isUpPressed' | 'isDownPressed' | 'isLeftPressed' | 'isRightPressed'>> = {
  ArrowUp: 'isUpPressed',
  ArrowDown: 'isDownPressed',
  ArrowLeft: 'isLeftPressed',
  ArrowRight: 'isRightPressed',
};
const PUNCH_KEY = 'KeyZ';
const KICK_KEY = 'KeyX';
const BLOCK_KEY = 'KeyC';
const GAME_KEYS = new Set([...Object.keys(DIRECTION_KEYS), PUNCH_KEY, KICK_KEY, BLOCK_KEY]);

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

// 방향키 + Z/X/C 입력을 모은다.
// - event.code를 써서 한글 입력 상태와 무관하게 동작한다.
// - 게임 키는 브라우저 기본 동작(스크롤)을 막는다.
// - 창이 포커스를 잃으면 눌린 키를 모두 뗀 것으로 본다.
export class KeyboardInput {
  private readonly input = createEmptyInput();

  constructor(private readonly onChange: () => void) {
    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    window.addEventListener('keyup', (event) => this.handleKeyUp(event));
    window.addEventListener('blur', () => this.releaseAllKeys());
  }

  getInput(): PlayerInput {
    return { ...this.input };
  }

  // Cmd/Ctrl/Alt 조합(복사·붙여넣기 등)은 게임 입력으로 보지 않고 브라우저 기본 동작에 맡긴다.
  private handleKeyDown(event: KeyboardEvent): void {
    if (!GAME_KEYS.has(event.code) || isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    const directionKey = DIRECTION_KEYS[event.code];
    if (directionKey) {
      this.input[directionKey] = true;
    } else if (event.code === PUNCH_KEY) {
      this.input.punchCount += 1;
    } else if (event.code === KICK_KEY) {
      this.input.kickCount += 1;
    } else {
      this.input.isBlockPressed = true;
    }
    this.onChange();
  }

  // macOS는 Cmd를 누른 동안 다른 키의 keyup을 보내지 않으므로, Cmd를 떼면 모든 키를 뗀 것으로 본다.
  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Meta') {
      this.releaseAllKeys();
      return;
    }
    const directionKey = DIRECTION_KEYS[event.code];
    if (directionKey) {
      this.input[directionKey] = false;
    } else if (event.code === BLOCK_KEY) {
      this.input.isBlockPressed = false;
    } else {
      return;
    }
    this.onChange();
  }

  private releaseAllKeys(): void {
    Object.values(DIRECTION_KEYS).forEach((key) => {
      this.input[key] = false;
    });
    this.input.isBlockPressed = false;
    this.onChange();
  }
}
