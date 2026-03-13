// (c) 2026 MiraNova Studios
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { FONTS } from '../utils/constants.js';

type ActionCallback = () => void;

const BTN_NORMAL = 0x334455;
const BTN_HOVER = 0x445566;
const BTN_BORDER = 0x5588aa;

class Button extends Container {
  private bg: Graphics;
  private btnLabel: Text;
  private btnWidth: number;
  private btnHeight: number;

  constructor(text: string, width = 120, height = 44) {
    super();
    this.btnWidth = width;
    this.btnHeight = height;

    this.bg = new Graphics();
    this.drawBg(BTN_NORMAL);
    this.addChild(this.bg);

    this.btnLabel = new Text({ text, style: FONTS.button as TextStyleOptions });
    this.btnLabel.anchor.set(0.5);
    this.addChild(this.btnLabel);

    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.on('pointerover', () => this.drawBg(BTN_HOVER));
    this.on('pointerout', () => this.drawBg(BTN_NORMAL));
  }

  setText(text: string): void {
    this.btnLabel.text = text;
  }

  private drawBg(color: number): void {
    this.bg.clear();
    this.bg.roundRect(-this.btnWidth / 2, -this.btnHeight / 2, this.btnWidth, this.btnHeight, 8);
    this.bg.fill({ color, alpha: 1 });
    this.bg.stroke({ color: BTN_BORDER, width: 2 });
  }
}

export class ActionBar extends Container {
  private leftBtn: Button;   // Check / Call
  private middleBtn: Button;  // Bet / Raise
  private rightBtn: Button;   // Fold

  // Bet input (HTML overlay)
  private betInputEl: HTMLInputElement | null = null;
  private betInputContainer: HTMLDivElement | null = null;

  private onLeftClick: ActionCallback | null = null;
  private onMiddleClick: ActionCallback | null = null;
  private onRightClick: ActionCallback | null = null;

  constructor() {
    super();

    // Evenly spaced: -150, -50, +50 (input), +150
    this.leftBtn = new Button('Check', 120, 44);
    this.leftBtn.x = -150;
    this.leftBtn.on('pointerdown', () => this.onLeftClick?.());
    this.addChild(this.leftBtn);

    this.middleBtn = new Button('Bet', 120, 44);
    this.middleBtn.x = -20;
    this.middleBtn.on('pointerdown', () => this.onMiddleClick?.());
    this.addChild(this.middleBtn);

    // Bet input at x=110 (to the right of Bet/Raise)

    this.rightBtn = new Button('Fold', 120, 44);
    this.rightBtn.x = 240;
    this.rightBtn.on('pointerdown', () => this.onRightClick?.());
    this.addChild(this.rightBtn);

    this.createBetInput();
    this.hide();
  }

  setCallbacks(onLeft: ActionCallback, onMiddle: ActionCallback, onRight: ActionCallback): void {
    this.onLeftClick = onLeft;
    this.onMiddleClick = onMiddle;
    this.onRightClick = onRight;
  }

  updateLabels(validActions: string[]): void {
    const hasCheck = validActions.includes('check');
    const hasBet = validActions.includes('bet');
    const hasRaise = validActions.includes('raise');

    this.leftBtn.setText(hasCheck ? 'Check' : 'Call');
    this.middleBtn.setText(hasBet ? 'Bet' : 'Raise');
    this.rightBtn.setText('Fold');

    // Show/hide bet input
    if (this.betInputContainer) {
      this.betInputContainer.style.display = (hasBet || hasRaise) ? 'block' : 'none';
    }
  }

  getBetAmount(defaultBet: number): number {
    if (!this.betInputEl || !this.betInputEl.value) return defaultBet;
    const val = parseInt(this.betInputEl.value, 10);
    return isNaN(val) || val <= 0 ? defaultBet : val;
  }

  setMinBet(amount: number): void {
    if (this.betInputEl) {
      this.betInputEl.placeholder = `$${amount}`;
    }
  }

  show(): void {
    this.visible = true;
    // Reset bet input to empty each turn
    if (this.betInputEl) {
      this.betInputEl.value = '';
    }
    if (this.betInputContainer) {
      this.betInputContainer.style.display = 'block';
    }
  }

  hide(): void {
    this.visible = false;
    if (this.betInputContainer) {
      this.betInputContainer.style.display = 'none';
    }
  }

  /** Position the HTML bet input to overlay near the action bar */
  updateInputPosition(screenX: number, screenY: number, scale: number): void {
    if (this.betInputContainer) {
      // Position at x=110 in design space (right of Bet/Raise button), centered vertically
      const inputX = screenX + 110 * scale;
      const inputW = 120 * scale;
      const inputH = 44 * scale;
      this.betInputContainer.style.left = `${inputX - inputW / 2}px`;
      this.betInputContainer.style.top = `${screenY - inputH / 2}px`;
      this.betInputContainer.style.width = `${inputW}px`;
      this.betInputContainer.style.height = `${inputH}px`;
    }
  }

  destroy(): void {
    this.betInputContainer?.remove();
    super.destroy();
  }

  private createBetInput(): void {
    this.betInputContainer = document.createElement('div');
    this.betInputContainer.style.cssText = `
      position: absolute;
      display: none;
      z-index: 10;
    `;

    this.betInputEl = document.createElement('input');
    this.betInputEl.type = 'text';
    this.betInputEl.inputMode = 'numeric';
    this.betInputEl.placeholder = '';
    this.betInputEl.style.cssText = `
      width: 100%;
      height: 100%;
      padding: 0 8px;
      font-size: 18px;
      background: #1a1a2e;
      color: #ffffff;
      border: 2px solid #5588aa;
      border-radius: 8px;
      text-align: left;
      outline: none;
      box-sizing: border-box;
      -moz-appearance: textfield;
    `;
    // Only allow digits
    this.betInputEl.addEventListener('input', () => {
      this.betInputEl!.value = this.betInputEl!.value.replace(/[^0-9]/g, '');
    });
    this.betInputEl.addEventListener('focus', () => {
      this.betInputEl!.style.borderColor = '#88ccff';
    });
    this.betInputEl.addEventListener('blur', () => {
      this.betInputEl!.style.borderColor = '#5588aa';
    });

    this.betInputContainer.appendChild(this.betInputEl);
    document.body.appendChild(this.betInputContainer);
  }
}
