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

  deckType: DeckType = 'png';
}
