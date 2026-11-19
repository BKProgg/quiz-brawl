import { queryElement } from './dom-helpers';

const ACTION_LABELS: Record<string, string> = {
  ArrowUp: '이동',
  ArrowDown: '이동',
  ArrowLeft: '이동',
  ArrowRight: '이동',
  KeyZ: '주먹!',
  KeyX: '발차기!',
  KeyC: '막기!',
};
const CLOSE_KEYS = new Set(['Escape', 'Enter']);
const AUTO_HIDE_MILLISECONDS = 10_000;
const FADE_MILLISECONDS = 1000;

// 입장하면 화면 아래에 반투명한 큰 키보드(방향키 + Z/X/C)를 띄운다.
// 키를 누르면 그 키가 눌린 모양이 되고, 무슨 동작인지 크게 보여 준다. 화면 클릭은 가로막지 않는다.
// 10초 뒤 스르륵 사라지고, Esc·Enter로 바로 닫을 수도 있다.
export class TutorialView {
  private readonly panel = queryElement<HTMLElement>('#tutorial');
  private readonly actionLabel = queryElement<HTMLParagraphElement>('#tutorial-action');
  private readonly keys = new Map<string, HTMLElement>();
  private autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.panel.querySelectorAll<HTMLElement>('[data-code]').forEach((key) => this.keys.set(key.dataset.code ?? '', key));
    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    window.addEventListener('keyup', (event) => this.keys.get(event.code)?.classList.remove('is-pressed'));
    window.addEventListener('blur', () => this.keys.forEach((key) => key.classList.remove('is-pressed')));
  }

  show(): void {
    this.clearTimers();
    this.panel.classList.remove('is-fading');
    this.panel.hidden = false;
    this.autoHideTimer = setTimeout(() => this.fadeOut(), AUTO_HIDE_MILLISECONDS);
  }

  hide(): void {
    this.clearTimers();
    this.panel.classList.remove('is-fading');
    this.panel.hidden = true;
  }

  private fadeOut(): void {
    this.clearTimers();
    this.panel.classList.add('is-fading');
    this.fadeTimer = setTimeout(() => this.hide(), FADE_MILLISECONDS);
  }

  private clearTimers(): void {
    [this.autoHideTimer, this.fadeTimer].forEach((timer) => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    });
    this.autoHideTimer = null;
    this.fadeTimer = null;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.panel.hidden) {
      return;
    }
    if (CLOSE_KEYS.has(event.key)) {
      this.fadeOut();
      return;
    }
    const label = ACTION_LABELS[event.code];
    if (!label || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    this.keys.get(event.code)?.classList.add('is-pressed');
    this.actionLabel.textContent = label;
    this.actionLabel.classList.remove('is-popping');
    void this.actionLabel.offsetWidth;
    this.actionLabel.classList.add('is-popping');
  }
}
