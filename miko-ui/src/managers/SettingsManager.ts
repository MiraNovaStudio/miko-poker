// (c) 2026 MiraNova Studios
export type DeckType = 'png' | 'unicode';
export type ChipDisplay = 'dollar' | 'bb';

const DECK_KEY = 'miko_deckType';
const NAME_KEY = 'miko_playerName';
const CHIP_DISPLAY_KEY = 'miko_chipDisplay';
const CARD_ANIMS_KEY = 'miko_cardAnimations';
const FOUR_COLOR_KEY = 'miko_fourColorDeck';
const DEFAULT_NAME = 'Player';
const BIG_BLIND = 10;

/** Format a chip amount as "$100" or "10 BB" depending on settings. */
export function formatChips(amount: number): string {
  if (SettingsManager.instance.chipDisplay === 'bb') {
    const bb = amount / BIG_BLIND;
    const formatted = Number.isInteger(bb) ? bb.toString() : bb.toFixed(1);
    return `${formatted} BB`;
  }
  return `$${amount}`;
}

export class SettingsManager {
  private static _instance: SettingsManager | null = null;

  static get instance(): SettingsManager {
    if (!SettingsManager._instance) {
      SettingsManager._instance = new SettingsManager();
    }
    return SettingsManager._instance;
  }

  private _deckType: DeckType;
  private _playerName: string;
  private _chipDisplay: ChipDisplay;
  private _cardAnimations: boolean;
  private _fourColorDeck: boolean;
  private _onChange: (() => void) | null = null;

  private constructor() {
    const savedDeck = localStorage.getItem(DECK_KEY);
    this._deckType = (savedDeck === 'png' || savedDeck === 'unicode') ? savedDeck : 'unicode';
    this._playerName = localStorage.getItem(NAME_KEY) || DEFAULT_NAME;
    const savedChip = localStorage.getItem(CHIP_DISPLAY_KEY);
    this._chipDisplay = (savedChip === 'dollar' || savedChip === 'bb') ? savedChip : 'dollar';
    const savedAnims = localStorage.getItem(CARD_ANIMS_KEY);
    this._cardAnimations = savedAnims !== 'false'; // default: on
    const savedFourColor = localStorage.getItem(FOUR_COLOR_KEY);
    this._fourColorDeck = savedFourColor === 'true'; // default: off
  }

  get deckType(): DeckType {
    return this._deckType;
  }

  set deckType(value: DeckType) {
    if (this._deckType === value) return;
    this._deckType = value;
    localStorage.setItem(DECK_KEY, value);
    this._onChange?.();
  }

  get playerName(): string {
    return this._playerName;
  }

  set playerName(value: string) {
    const trimmed = value.trim() || DEFAULT_NAME;
    if (this._playerName === trimmed) return;
    this._playerName = trimmed;
    localStorage.setItem(NAME_KEY, trimmed);
    this._onChange?.();
  }

  get chipDisplay(): ChipDisplay {
    return this._chipDisplay;
  }

  set chipDisplay(value: ChipDisplay) {
    if (this._chipDisplay === value) return;
    this._chipDisplay = value;
    localStorage.setItem(CHIP_DISPLAY_KEY, value);
    this._onChange?.();
  }

  get cardAnimations(): boolean {
    return this._cardAnimations;
  }

  set cardAnimations(value: boolean) {
    if (this._cardAnimations === value) return;
    this._cardAnimations = value;
    localStorage.setItem(CARD_ANIMS_KEY, String(value));
    this._onChange?.();
  }

  get fourColorDeck(): boolean {
    return this._fourColorDeck;
  }

  set fourColorDeck(value: boolean) {
    if (this._fourColorDeck === value) return;
    this._fourColorDeck = value;
    localStorage.setItem(FOUR_COLOR_KEY, String(value));
    this._onChange?.();
  }

  /** Register a callback for when settings change */
  onChange(cb: () => void): void {
    this._onChange = cb;
  }
}
