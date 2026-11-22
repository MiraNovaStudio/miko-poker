// (c) 2026 MiraNova Studio
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

  // Preaction button (Check/Fold or Fold)
  private preactionBtn: Container;
  private preactionBg: Graphics;
  private preactionLabel: Text;
  private preactionCheckbox: Graphics;
  private _preactionActive = false;
  private _preactionType: 'checkfold' | 'fold' = 'fold';
  onPreactionChanged: ((active: boolean, type: 'checkfold' | 'fold') => void) | null = null;

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

  /** True when the player has interacted with the slider or pot-fraction buttons this turn. */
  private _betInteracted = false;
  /** True when fold confirmation is showing (second click folds for real). */
  private _foldConfirming = false;
  /** True when check is available this turn (folding when you can check is always a mistake). */
  private _canCheck = false;

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
    this.rightBtn.on('pointerdown', () => this.handleFoldClick());
    this.addChild(this.rightBtn);

    // Preaction button — same position as Fold, shown when not player's turn
    this.preactionBtn = new Container();
    this.preactionBtn.x = 240;
    this.preactionBtn.visible = false;
    this.preactionBtn.eventMode = 'static';
    this.preactionBtn.cursor = 'pointer';

    this.preactionBg = new Graphics();
    this.drawPreactionBg(BTN_NORMAL);
    this.preactionBtn.addChild(this.preactionBg);

    // Checkbox (left side of button)
    this.preactionCheckbox = new Graphics();
    this.drawCheckbox(false);
    this.preactionBtn.addChild(this.preactionCheckbox);

    // Label (right of checkbox)
    this.preactionLabel = new Text({ text: 'Check/Fold', style: {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: 0xffffff,
    } as TextStyleOptions });
    this.preactionLabel.anchor.set(0, 0.5);
    this.preactionLabel.x = -46;
    this.preactionBtn.addChild(this.preactionLabel);

    this.preactionBtn.on('pointerover', () => {
      if (!this._preactionActive) this.drawPreactionBg(BTN_HOVER);
    });
    this.preactionBtn.on('pointerout', () => {
      if (!this._preactionActive) this.drawPreactionBg(BTN_NORMAL);
    });
    this.preactionBtn.on('pointerdown', () => this.togglePreaction());

    this.addChild(this.preactionBtn);

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

    this._canCheck = hasCheck;
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

  /** Set the input value and flash red briefly to indicate it was auto-clamped. */
  flashClampedBet(amount: number): void {
    if (!this.betInputEl) return;
    this.betInputEl.value = String(amount);
    this.betInputEl.style.borderColor = '#ff4444';
    this.betInputEl.style.color = '#ff4444';
    setTimeout(() => {
      if (!this.betInputEl) return;
      this.betInputEl.style.borderColor = '#5588aa';
      this.betInputEl.style.color = '#fff';
    }, 600);
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
    // Hide preaction when real action bar is shown
    this.preactionBtn.visible = false;
    // Reset bet interaction tracking for this turn
    this._betInteracted = false;
    this._foldConfirming = false;
    // Reset bet input to empty each turn
    if (this.betInputEl) {
      this.betInputEl.value = '';
      // Update inputMode based on chip display setting
      this.betInputEl.inputMode =
        SettingsManager.instance.chipDisplay === 'bb' ? 'decimal' : 'numeric';
    }
    if (this.betInputContainer) {
      this.betInputContainer.style.display = this.hasBetOption ? 'block' : 'none';
    }
    if (this.sliderPanel) {
      this.sliderPanel.style.display = this.hasBetOption ? 'flex' : 'none';
    }
    // Trigger resize to ensure HTML overlays are correctly positioned
    window.dispatchEvent(new Event('resize'));
    // Show normal buttons — hide Raise/Bet button when player can't raise
    this.leftBtn.visible = true;
    this.middleBtn.visible = this.hasBetOption;
    this.rightBtn.visible = true;
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

  // ─── Preaction ─────────────────────────────────────────────

  /** Show the preaction button. canCheck indicates whether check is possible. */
  showPreaction(canCheck: boolean): void {
    this._preactionType = canCheck ? 'checkfold' : 'fold';
    this.preactionLabel.text = canCheck ? 'Check/Fold' : 'Fold';
    // Ensure the container is "visible" so preaction renders, but hide normal buttons
    this.visible = true;
    this.leftBtn.visible = false;
    this.middleBtn.visible = false;
    this.rightBtn.visible = false;
    if (this.betInputContainer) this.betInputContainer.style.display = 'none';
    if (this.sliderPanel) this.sliderPanel.style.display = 'none';
    this.preactionBtn.visible = true;
  }

  /** Hide the preaction button and clear the selection. */
  hidePreaction(): void {
    this.preactionBtn.visible = false;
    this._preactionActive = false;
    this.drawCheckbox(false);
    this.drawPreactionBg(BTN_NORMAL);
  }

  /** Returns true if preaction is currently toggled on. */
  get preactionActive(): boolean {
    return this._preactionActive;
  }

  /** Returns the preaction type ('checkfold' or 'fold'). */
  get preactionType(): 'checkfold' | 'fold' {
    return this._preactionType;
  }

  /** Clear preaction state without hiding (used on street changes). */
  clearPreaction(): void {
    this._preactionActive = false;
    this.drawCheckbox(false);
    this.drawPreactionBg(BTN_NORMAL);
  }

  private togglePreaction(): void {
    this._preactionActive = !this._preactionActive;
    this.drawCheckbox(this._preactionActive);
    this.drawPreactionBg(this._preactionActive ? 0x2a4a5a : BTN_NORMAL);
    this.onPreactionChanged?.(this._preactionActive, this._preactionType);
  }

  private drawPreactionBg(color: number): void {
    const w = 150;
    const h = 44;
    this.preactionBg.clear();
    this.preactionBg.roundRect(-w / 2, -h / 2, w, h, 8);
    this.preactionBg.fill({ color, alpha: 1 });
    this.preactionBg.stroke({ color: BTN_BORDER, width: 2 });
  }

  private drawCheckbox(checked: boolean): void {
    const size = 14;
    const x = -66;
    const y = -size / 2;
    this.preactionCheckbox.clear();
    this.preactionCheckbox.roundRect(x, y, size, size, 2);
    this.preactionCheckbox.stroke({ color: 0x88ccff, width: 1.5 });
    if (checked) {
      this.preactionCheckbox.roundRect(x + 2, y + 2, size - 4, size - 4, 1);
      this.preactionCheckbox.fill({ color: 0x88ccff });
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
      if (this.betInputEl) {
        this.betInputEl.style.fontSize = `${Math.max(11, 18 * scale)}px`;
      }
    }

    // Position slider panel to the right of the bet input, scaled with the scene
    if (this.sliderPanel) {
      const panelX = screenX + 340 * scale;
      const panelY = screenY - 160 * scale;
      // Clamp to viewport so the panel doesn't overflow off-screen
      const panelW = 120 * scale;  // approximate scaled width of panel
      const maxX = window.innerWidth - panelW - 4;
      this.sliderPanel.style.left = `${Math.min(panelX, maxX)}px`;
      this.sliderPanel.style.top = `${Math.max(panelY, 4)}px`;
      this.sliderPanel.style.right = '';
      this.sliderPanel.style.transform = `scale(${scale})`;
      this.sliderPanel.style.transformOrigin = 'top left';
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
    // Inject slider thumb styles once
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .miko-bet-slider::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 18px; height: 18px; border-radius: 50%;
        background: #fff; border: 2px solid #5588aa;
        cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .miko-bet-slider::-moz-range-thumb {
        width: 18px; height: 18px; border-radius: 50%;
        background: #fff; border: 2px solid #5588aa;
        cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
    `;
    document.head.appendChild(styleEl);

    // Outer panel: horizontal row — [buttons column] [slider column]
    this.sliderPanel = document.createElement('div');
    this.sliderPanel.style.cssText = `
      position: fixed;
      display: none;
      flex-direction: row;
      align-items: stretch;
      gap: 6px;
      z-index: 10;
      padding: 8px 8px;
      background: rgba(26, 26, 46, 0.92);
      border: 2px solid #5588aa;
      border-radius: 10px;
      user-select: none;
    `;

    // ── Left: pot-fraction buttons stacked vertically ──
    const btnColumn = document.createElement('div');
    btnColumn.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 3px;
      justify-content: space-between;
    `;

    const fractions: { label: string; fraction: number | 'allin' }[] = [
      { label: 'All In', fraction: 'allin' },
      { label: 'Pot', fraction: 1.0 },
      { label: '3/4', fraction: 0.75 },
      { label: '1/2', fraction: 0.5 },
      { label: '1/4', fraction: 0.25 },
    ];

    for (const { label, fraction } of fractions) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        width: 52px;
        padding: 4px 0;
        border: 1px solid #5588aa;
        border-radius: 4px;
        background: rgba(51, 68, 85, 0.85);
        color: #cde;
        font-family: Arial, sans-serif;
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.12s, color 0.12s;
        text-align: center;
        line-height: 1.2;
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
        this._betInteracted = true;
        this.resetFoldConfirm();
        if (fraction === 'allin') {
          this.setBetFromSlider(this.sliderMax);
        } else {
          const raiseTotal = this.sliderCallAmount
            + Math.floor(fraction * (this.sliderPot + this.sliderCallAmount));
          const clamped = Math.min(Math.max(raiseTotal, this.sliderMin), this.sliderMax);
          this.setBetFromSlider(clamped);
        }
      });
      btnColumn.appendChild(btn);
    }

    this.sliderPanel.appendChild(btnColumn);

    // ── Right: vertical slider + amount label ──
    const sliderColumn = document.createElement('div');
    sliderColumn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    `;

    // Amount label
    this.sliderAmountLabel = document.createElement('div');
    this.sliderAmountLabel.style.cssText = `
      color: #fff;
      font-family: Arial, sans-serif;
      font-size: 11px;
      font-weight: bold;
      text-align: center;
      white-space: nowrap;
    `;
    this.sliderAmountLabel.textContent = '$0';
    sliderColumn.appendChild(this.sliderAmountLabel);

    // Vertical slider (rotated range input)
    const sliderWrap = document.createElement('div');
    sliderWrap.style.cssText = `
      width: 24px;
      height: 130px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    this.sliderEl = document.createElement('input');
    this.sliderEl.type = 'range';
    this.sliderEl.min = '0';
    this.sliderEl.max = '1000';
    this.sliderEl.value = '0';
    this.sliderEl.classList.add('miko-bet-slider');
    this.sliderEl.style.cssText = `
      -webkit-appearance: none; appearance: none;
      width: 130px;
      height: 5px;
      background: linear-gradient(to right, #3a5a7a, #5588aa, #4ade80);
      border-radius: 3px;
      outline: none;
      transform: rotate(-90deg);
      transform-origin: center center;
      cursor: pointer;
    `;

    this.sliderEl.addEventListener('input', () => {
      this._betInteracted = true;
      this.resetFoldConfirm();
      const val = parseInt(this.sliderEl!.value, 10);
      this.setBetFromSlider(val);
    });

    sliderWrap.appendChild(this.sliderEl);
    sliderColumn.appendChild(sliderWrap);

    this.sliderPanel.appendChild(sliderColumn);
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

  /** Handle fold button click — confirm if player interacted with bet controls or can check. */
  private handleFoldClick(): void {
    if ((this._betInteracted || this._canCheck) && !this._foldConfirming) {
      // First click: show confirmation
      this._foldConfirming = true;
      this.rightBtn.setText('Sure?');
      return;
    }
    // No bet interaction and can't check, or second click confirms fold
    this.resetFoldConfirm();
    this.onRightClick?.();
  }

  /** Reset fold confirmation state back to normal. */
  private resetFoldConfirm(): void {
    if (this._foldConfirming) {
      this._foldConfirming = false;
      this.rightBtn.setText('Fold');
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
