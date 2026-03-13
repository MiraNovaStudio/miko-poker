// (c) 2026 MiraNova Studios
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { FONTS } from '../utils/constants.js';
import { SettingsManager, formatChips } from '../managers/SettingsManager.js';

type ActionCallback = () => void;

const BTN_NORMAL = 0x334455;
const BTN_HOVER = 0x445566;
const BTN_BORDER = 0x5588aa;
const BIG_BLIND = 10;

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

  // Bet slider panel (HTML overlay)
  private sliderPanel: HTMLDivElement | null = null;
  private sliderEl: HTMLInputElement | null = null;
  private sliderAmountLabel: HTMLDivElement | null = null;
  private sliderMin = 0;
  private sliderMax = 0;
  private sliderPot = 0;
  private sliderCallAmount = 0;
  private hasBetOption = false;

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
    this.createSliderPanel();
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

    this.hasBetOption = hasBet || hasRaise;

    // Show/hide bet input and slider
    if (this.betInputContainer) {
      this.betInputContainer.style.display = this.hasBetOption ? 'block' : 'none';
    }
    if (this.sliderPanel) {
      this.sliderPanel.style.display = this.hasBetOption ? 'flex' : 'none';
    }
  }

  /** Get bet amount in dollars. In BB mode, converts BB input to dollars. */
  getBetAmount(defaultBet: number): number {
    if (!this.betInputEl || !this.betInputEl.value) return defaultBet;
    const raw = this.betInputEl.value;

    if (SettingsManager.instance.chipDisplay === 'bb') {
      const bbVal = parseFloat(raw);
      if (isNaN(bbVal) || bbVal <= 0) return defaultBet;
      return Math.round(bbVal * BIG_BLIND);
    }

    const val = parseInt(raw, 10);
    return isNaN(val) || val <= 0 ? defaultBet : val;
  }

  /** Set the placeholder to show the minimum bet/raise amount. */
  setMinBet(amount: number): void {
    if (this.betInputEl) {
      this.betInputEl.placeholder = formatChips(amount);
    }
  }

  /** Configure the slider range and pot-fraction values. */
  setBetLimits(min: number, max: number, pot: number, callAmount: number): void {
    this.sliderMin = min;
    this.sliderMax = max;
    this.sliderPot = pot;
    this.sliderCallAmount = callAmount;

    if (this.sliderEl) {
      this.sliderEl.min = String(min);
      this.sliderEl.max = String(max);
      this.sliderEl.value = String(min);
      this.updateSliderAmount(min);
    }
  }

  show(): void {
    this.visible = true;
    // Reset bet input to empty each turn
    if (this.betInputEl) {
      this.betInputEl.value = '';
      // Update inputMode based on chip display setting
      this.betInputEl.inputMode =
        SettingsManager.instance.chipDisplay === 'bb' ? 'decimal' : 'numeric';
    }
    if (this.betInputContainer) {
      this.betInputContainer.style.display = 'block';
    }
    if (this.sliderPanel && this.hasBetOption) {
      this.sliderPanel.style.display = 'flex';
    }
  }

  hide(): void {
    this.visible = false;
    if (this.betInputContainer) {
      this.betInputContainer.style.display = 'none';
    }
    if (this.sliderPanel) {
      this.sliderPanel.style.display = 'none';
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

    // Position slider panel in the lower right of the viewport
    if (this.sliderPanel) {
      // Anchor: right edge of the viewport, vertically centered on the action bar area
      const panelW = 76;  // fixed width in px
      const panelH = 280; // approximate height
      const margin = 12;

      // Right edge, vertically aligned with action bar
      const right = margin;
      const top = screenY - panelH / 2;

      this.sliderPanel.style.right = `${right}px`;
      this.sliderPanel.style.top = `${Math.max(margin, top)}px`;
    }
  }

  destroy(): void {
    this.betInputContainer?.remove();
    this.sliderPanel?.remove();
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
    // Allow digits, and decimal point in BB mode
    this.betInputEl.addEventListener('input', () => {
      if (SettingsManager.instance.chipDisplay === 'bb') {
        this.betInputEl!.value = this.betInputEl!.value.replace(/[^0-9.]/g, '');
        // Only allow one decimal point
        const parts = this.betInputEl!.value.split('.');
        if (parts.length > 2) {
          this.betInputEl!.value = parts[0] + '.' + parts.slice(1).join('');
        }
      } else {
        this.betInputEl!.value = this.betInputEl!.value.replace(/[^0-9]/g, '');
      }
      // Sync slider to typed value
      this.syncSliderFromInput();
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

  // ─── Bet Slider Panel ───────────────────────────────────────

  private createSliderPanel(): void {
    this.sliderPanel = document.createElement('div');
    this.sliderPanel.style.cssText = `
      position: fixed;
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      z-index: 10;
      padding: 8px 6px;
      background: rgba(26, 26, 46, 0.92);
      border: 2px solid #5588aa;
      border-radius: 10px;
      user-select: none;
    `;

    // Amount label at top
    this.sliderAmountLabel = document.createElement('div');
    this.sliderAmountLabel.style.cssText = `
      color: #fff;
      font-family: Arial, sans-serif;
      font-size: 13px;
      font-weight: bold;
      text-align: center;
      padding: 2px 0 4px;
      min-width: 60px;
    `;
    this.sliderAmountLabel.textContent = '$0';
    this.sliderPanel.appendChild(this.sliderAmountLabel);

    // Vertical slider (range input rotated)
    const sliderWrap = document.createElement('div');
    sliderWrap.style.cssText = `
      width: 30px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    `;

    this.sliderEl = document.createElement('input');
    this.sliderEl.type = 'range';
    this.sliderEl.min = '0';
    this.sliderEl.max = '1000';
    this.sliderEl.value = '0';
    this.sliderEl.style.cssText = `
      -webkit-appearance: none;
      appearance: none;
      width: 120px;
      height: 6px;
      background: linear-gradient(to right, #3a5a7a, #5588aa, #4ade80);
      border-radius: 3px;
      outline: none;
      transform: rotate(-90deg);
      transform-origin: center center;
      cursor: pointer;
    `;

    // Slider thumb styling via a <style> tag
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .miko-bet-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #5588aa;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .miko-bet-slider::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #5588aa;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
    `;
    document.head.appendChild(styleEl);
    this.sliderEl.classList.add('miko-bet-slider');

    this.sliderEl.addEventListener('input', () => {
      const val = parseInt(this.sliderEl!.value, 10);
      this.setBetFromSlider(val);
    });

    sliderWrap.appendChild(this.sliderEl);
    this.sliderPanel.appendChild(sliderWrap);

    // Pot fraction buttons
    const fractions: { label: string; fraction: number | 'allin' }[] = [
      { label: '1/4', fraction: 0.25 },
      { label: '1/2', fraction: 0.5 },
      { label: '3/4', fraction: 0.75 },
      { label: 'Pot', fraction: 1.0 },
      { label: 'All In', fraction: 'allin' },
    ];

    for (const { label, fraction } of fractions) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        width: 62px;
        padding: 5px 0;
        border: 1px solid #5588aa;
        border-radius: 5px;
        background: rgba(51, 68, 85, 0.85);
        color: #cde;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.12s, color 0.12s;
        text-align: center;
      `;
      btn.addEventListener('pointerover', () => {
        btn.style.background = 'rgba(85, 136, 170, 0.6)';
        btn.style.color = '#fff';
      });
      btn.addEventListener('pointerout', () => {
        btn.style.background = 'rgba(51, 68, 85, 0.85)';
        btn.style.color = '#cde';
      });
      btn.addEventListener('click', () => {
        if (fraction === 'allin') {
          this.setBetFromSlider(this.sliderMax);
        } else {
          // Pot-fraction raise = callAmount + fraction * (pot + callAmount)
          const raiseTotal = this.sliderCallAmount + Math.floor(fraction * (this.sliderPot + this.sliderCallAmount));
          const clamped = Math.min(Math.max(raiseTotal, this.sliderMin), this.sliderMax);
          this.setBetFromSlider(clamped);
        }
      });
      this.sliderPanel.appendChild(btn);
    }

    document.body.appendChild(this.sliderPanel);
  }

  /** Set bet amount from slider value, update input and label. */
  private setBetFromSlider(value: number): void {
    const clamped = Math.min(Math.max(value, this.sliderMin), this.sliderMax);
    if (this.sliderEl) this.sliderEl.value = String(clamped);
    if (this.betInputEl) {
      if (SettingsManager.instance.chipDisplay === 'bb') {
        this.betInputEl.value = (clamped / BIG_BLIND).toFixed(1);
      } else {
        this.betInputEl.value = String(clamped);
      }
    }
    this.updateSliderAmount(clamped);
  }

  /** Update the amount display label above the slider. */
  private updateSliderAmount(value: number): void {
    if (this.sliderAmountLabel) {
      this.sliderAmountLabel.textContent = formatChips(value);
    }
  }

  /** Sync slider position when user types in the bet input. */
  private syncSliderFromInput(): void {
    if (!this.betInputEl || !this.sliderEl) return;
    const raw = this.betInputEl.value;
    let dollars: number;
    if (SettingsManager.instance.chipDisplay === 'bb') {
      const bbVal = parseFloat(raw);
      if (isNaN(bbVal) || bbVal <= 0) return;
      dollars = Math.round(bbVal * BIG_BLIND);
    } else {
      dollars = parseInt(raw, 10);
      if (isNaN(dollars) || dollars <= 0) return;
    }
    const clamped = Math.min(Math.max(dollars, this.sliderMin), this.sliderMax);
    this.sliderEl.value = String(clamped);
    this.updateSliderAmount(clamped);
  }
}
