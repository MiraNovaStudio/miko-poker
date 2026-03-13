// (c) 2026 MiraNova Studios
export type DeckType = 'png' | 'unicode';

const STORAGE_KEY = 'miko_deckType';

export class SettingsManager {
  private static _instance: SettingsManager | null = null;

  static get instance(): SettingsManager {
    if (!SettingsManager._instance) {
      SettingsManager._instance = new SettingsManager();
    }
    return SettingsManager._instance;
  }

  private _deckType: DeckType;
  private _onChange: (() => void) | null = null;

  private constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this._deckType = (saved === 'png' || saved === 'unicode') ? saved : 'unicode';
  }

  get deckType(): DeckType {
    return this._deckType;
  }

  set deckType(value: DeckType) {
    if (this._deckType === value) return;
    this._deckType = value;
    localStorage.setItem(STORAGE_KEY, value);
    this._onChange?.();
  }

  /** Register a callback for when settings change */
  onChange(cb: () => void): void {
    this._onChange = cb;
  }
}
