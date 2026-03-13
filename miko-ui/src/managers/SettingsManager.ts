// (c) 2026 MiraNova Studios
export type DeckType = 'png' | 'unicode';

export class SettingsManager {
  private static _instance: SettingsManager | null = null;

  static get instance(): SettingsManager {
    if (!SettingsManager._instance) {
      SettingsManager._instance = new SettingsManager();
    }
    return SettingsManager._instance;
  }

  private _deckType: DeckType = 'png';
  private _onChange: (() => void) | null = null;

  get deckType(): DeckType {
    return this._deckType;
  }

  set deckType(value: DeckType) {
    if (this._deckType === value) return;
    this._deckType = value;
    this._onChange?.();
  }

  /** Register a callback for when settings change */
  onChange(cb: () => void): void {
    this._onChange = cb;
  }
}
