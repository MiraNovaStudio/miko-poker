// (c) 2026 MiraNova Studios
const MAX_ENTRIES = 100;

export class HandHistory {
  private entries: string[] = [];
  private containerEl: HTMLDivElement;
  private listEl: HTMLDivElement;
  private toggleBtn: HTMLButtonElement;
  private sitOutEl: HTMLLabelElement;
  private sitOutCheckbox: HTMLInputElement;
  private isOpen = false;
  private _sitOut = false;
  private autoScroll = true;

  /** Callback fired when sit-out state changes */
  onSitOutChanged: ((active: boolean) => void) | null = null;

  get sitOut(): boolean { return this._sitOut; }

  constructor() {
    // Sit Out checkbox — above the History button
    this.sitOutEl = document.createElement('label');
    this.sitOutEl.style.cssText = `
      position: absolute;
      z-index: 6;
      display: none;
      align-items: center;
      gap: 5px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #88ccff;
      cursor: pointer;
      user-select: none;
    `;
    this.sitOutCheckbox = document.createElement('input');
    this.sitOutCheckbox.type = 'checkbox';
    this.sitOutCheckbox.style.cssText = 'cursor: pointer; accent-color: #5588aa;';
    this.sitOutCheckbox.addEventListener('change', () => {
      this._sitOut = this.sitOutCheckbox.checked;
      this.onSitOutChanged?.(this._sitOut);
    });
    this.sitOutEl.appendChild(this.sitOutCheckbox);
    this.sitOutEl.appendChild(document.createTextNode('Sit Out'));
    document.body.appendChild(this.sitOutEl);

    // Toggle button — bottom-left corner
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.textContent = 'History';
    this.toggleBtn.style.cssText = `
      position: absolute;
      z-index: 6;
      background: rgba(10, 10, 20, 0.8);
      border: 1px solid #5588aa;
      border-radius: 4px;
      padding: 4px 10px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #88ccff;
      cursor: pointer;
      display: none;
    `;
    this.toggleBtn.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.toggleBtn);

    // Scrollable panel — hidden by default
    this.containerEl = document.createElement('div');
    this.containerEl.id = 'hand-history';
    this.containerEl.style.cssText = `
      position: absolute;
      display: none;
      z-index: 5;
      background: rgba(10, 10, 20, 0.9);
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

    // Track scroll position: disable auto-scroll when user scrolls up,
    // re-enable when they scroll back to the bottom
    this.containerEl.addEventListener('scroll', () => {
      const el = this.containerEl;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
      this.autoScroll = atBottom;
    });

    // Click outside the history panel or toggle button to dismiss
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;
      const target = e.target as Node;
      if (!this.containerEl.contains(target) && !this.toggleBtn.contains(target)) {
        this.close();
      }
    });
  }

  /** Add a hand result message. New entries appear at the bottom. */
  addEntry(message: string): void {
    this.entries.push(message);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
      // Full re-render needed since we removed the first entry
      if (this.isOpen) this.render();
      return;
    }
    if (this.isOpen) {
      // Remove "No hands played yet" placeholder if present
      const placeholder = this.listEl.querySelector('div[style*="font-style: italic"]');
      if (placeholder) placeholder.remove();

      // Append incrementally instead of full re-render
      const line = document.createElement('div');
      line.textContent = message;
      line.style.cssText = `
        padding: 2px 0;
        border-bottom: 1px solid rgba(85, 136, 170, 0.2);
      `;
      this.listEl.appendChild(line);

      if (this.autoScroll) {
        this.containerEl.scrollTop = this.containerEl.scrollHeight;
      }
    }
  }

  /** Clear all history (e.g. on restart). */
  clear(): void {
    this.entries = [];
    if (this.isOpen) this.render();
  }

  /** Show the toggle button and sit-out checkbox (call on game start). */
  enable(): void {
    this.toggleBtn.style.display = 'block';
    this.sitOutEl.style.display = 'flex';
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.isOpen = true;
      this.autoScroll = true;
      this.render();
      this.containerEl.style.display = 'block';
      this.sitOutEl.style.display = 'none';
      this.toggleBtn.textContent = 'History ▾';
    }
  }

  private close(): void {
    this.isOpen = false;
    this.containerEl.style.display = 'none';
    this.sitOutEl.style.display = 'flex';
    this.toggleBtn.textContent = 'History';
  }

  /** Reposition/resize based on screen dimensions and scene center Y. */
  updatePosition(screenWidth: number, sceneCenterY: number, scale: number): void {
    const cx = screenWidth / 2;
    const cy = sceneCenterY;

    // Toggle button — bottom-left, just above the hand label area
    const btnLeft = cx + -460 * scale;
    const btnTop = cy + 240 * scale;
    this.toggleBtn.style.left = `${btnLeft}px`;
    this.toggleBtn.style.top = `${btnTop}px`;
    this.toggleBtn.style.fontSize = `${Math.max(11, 12 * scale)}px`;

    // Sit Out checkbox — above the History button
    this.sitOutEl.style.left = `${btnLeft}px`;
    this.sitOutEl.style.top = `${btnTop - 22 * scale}px`;
    this.sitOutEl.style.fontSize = `${Math.max(11, 12 * scale)}px`;

    // Panel — above the toggle button, anchored bottom-left
    const panelWidth = 420 * scale;
    const panelHeight = 200 * scale;
    const panelLeft = btnLeft;
    const panelBottom = btnTop;
    const panelTop = panelBottom - panelHeight;

    this.containerEl.style.left = `${panelLeft}px`;
    this.containerEl.style.top = `${panelTop}px`;
    this.containerEl.style.width = `${panelWidth}px`;
    this.containerEl.style.height = `${panelHeight}px`;
    this.containerEl.style.fontSize = `${Math.max(11, 13 * scale)}px`;
  }

  destroy(): void {
    this.containerEl.remove();
    this.toggleBtn.remove();
    this.sitOutEl.remove();
  }

  private render(): void {
    this.listEl.innerHTML = '';
    if (this.entries.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No hands played yet';
      empty.style.cssText = 'color: #666; font-style: italic; padding: 4px 0;';
      this.listEl.appendChild(empty);
      return;
    }
    for (const entry of this.entries) {
      const line = document.createElement('div');
      line.textContent = entry;
      line.style.cssText = `
        padding: 2px 0;
        border-bottom: 1px solid rgba(85, 136, 170, 0.2);
      `;
      this.listEl.appendChild(line);
    }
    // Auto-scroll to bottom so latest entry is visible
    if (this.autoScroll) {
      this.containerEl.scrollTop = this.containerEl.scrollHeight;
    }
  }
}
