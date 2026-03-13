// (c) 2026 MiraNova Studios
export type DeckType = 'png' | 'unicode';
export type ChipDisplay = 'dollar' | 'bb';

const DECK_KEY = 'miko_deckType';
const NAME_KEY = 'miko_playerName';
const CHIP_DISPLAY_KEY = 'miko_chipDisplay';
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
  private _onChange: (() => void) | null = null;

  private constructor() {
    const savedDeck = localStorage.getItem(DECK_KEY);
    this._deckType = (savedDeck === 'png' || savedDeck === 'unicode') ? savedDeck : 'unicode';
    this._playerName = localStorage.getItem(NAME_KEY) || DEFAULT_NAME;
    const savedChip = localStorage.getItem(CHIP_DISPLAY_KEY);
    this._chipDisplay = (savedChip === 'dollar' || savedChip === 'bb') ? savedChip : 'dollar';
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

  /** Register a callback for when settings change */
  onChange(cb: () => void): void {
    this._onChange = cb;
  }
}
