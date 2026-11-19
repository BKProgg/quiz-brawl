const LETTERBOX_COLOR = '#151925';

// 캔버스를 창 크기에 맞추고, 게임 좌표(1600x900)를 비율을 유지한 채 가운데에 놓는다.
export class CanvasViewport {
  readonly context: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly worldWidth: number, private readonly worldHeight: number) {
    this.context = canvas.getContext('2d') as CanvasRenderingContext2D;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // 지난 프레임에서 건 클립과 그리다 남은 상태를 먼저 버린다(restore). 클립은 되돌리지 않으면 프레임마다 쌓여, 화면을 오래 띄워 둘수록 느려진다.
  // 첫 프레임이나 창 크기를 바꾼 직후처럼 저장된 상태가 없을 때의 restore는 아무 일도 하지 않는다.
  beginFrame(): void {
    const ctx = this.context;
    ctx.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = LETTERBOX_COLOR;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const scale = Math.min(this.canvas.width / this.worldWidth, this.canvas.height / this.worldHeight);
    const offsetX = (this.canvas.width - this.worldWidth * scale) / 2;
    const offsetY = (this.canvas.height - this.worldHeight * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.beginPath();
    ctx.rect(0, 0, this.worldWidth, this.worldHeight);
    ctx.clip();
  }

  private resize(): void {
    const pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * pixelRatio);
    this.canvas.height = Math.round(window.innerHeight * pixelRatio);
  }
}
