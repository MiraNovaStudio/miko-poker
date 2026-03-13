// (c) 2026 MiraNova Studios
const MAX_ENTRIES = 100;

export class HandHistory {
  private entries: string[] = [];
  private containerEl: HTMLDivElement;
  private listEl: HTMLDivElement;

  constructor() {
    this.containerEl = document.createElement('div');
    this.containerEl.id = 'hand-history';
    this.containerEl.style.cssText = `
      position: absolute;
      display: none;
      z-index: 5;
      background: rgba(10, 10, 20, 0.85);
      border: 1px solid #5588aa;
      border-radius: 6px;
      padding: 6px 8px;
      overflow-y: auto;
      font-family: Arial, sans-serif;
      font-size: 13px;
      color: #cccccc;
      line-height: 1.4;
    `;

    this.listEl = document.createElement('div');
    this.containerEl.appendChild(this.listEl);
    document.body.appendChild(this.containerEl);
  }

  /** Add a hand result message. Most recent appears at top. */
  addEntry(message: string): void {
    this.entries.unshift(message);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.pop();
    }
    this.render();
  }

  /** Clear all history (e.g. on restart). */
  clear(): void {
    this.entries = [];
    this.render();
  }

  show(): void {
    this.containerEl.style.display = 'block';
  }

  hide(): void {
    this.containerEl.style.display = 'none';
  }

  /** Reposition/resize based on screen dimensions and scale factor. */
  updatePosition(screenWidth: number, screenHeight: number, scale: number): void {
    // Position in the bottom-left, above the status messages
    const designLeft = -460;
    const designTop = 200;
    const designWidth = 400;
    const designHeight = 180;

    const cx = screenWidth / 2;
    const cy = screenHeight / 2;

    const left = cx + designLeft * scale;
    const top = cy + designTop * scale;
    const width = designWidth * scale;
    const height = designHeight * scale;

    this.containerEl.style.left = `${left}px`;
    this.containerEl.style.top = `${top}px`;
    this.containerEl.style.width = `${width}px`;
    this.containerEl.style.height = `${height}px`;
    this.containerEl.style.fontSize = `${Math.max(11, 13 * scale)}px`;
  }

  destroy(): void {
    this.containerEl.remove();
  }

  private render(): void {
    this.listEl.innerHTML = '';
    for (const entry of this.entries) {
      const line = document.createElement('div');
      line.textContent = entry;
      line.style.cssText = `
        padding: 2px 0;
        border-bottom: 1px solid rgba(85, 136, 170, 0.2);
      `;
      this.listEl.appendChild(line);
    }
  }
}
