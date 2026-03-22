// (c) 2026 MiraNova Studios
import { Assets, Texture } from 'pixi.js';
import { RANK_TO_FILENAME } from '../utils/constants.js';

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
const RANKS = Object.keys(RANK_TO_FILENAME);

export class AssetManager {
  private static loaded = false;

  /** Preload all game textures. Call once at startup. */
  static async load(onProgress?: (progress: number) => void): Promise<void> {
    if (this.loaded) return;

    const manifest: { alias: string; src: string }[] = [];

    // Card faces (deck4)
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        const rankName = RANK_TO_FILENAME[rank];
        const alias = `card_${rank}_${suit}`;
        manifest.push({ alias, src: `assets/cards/${rankName}_of_${suit}.png` });
      }
    }

    // Card back
    manifest.push({ alias: 'card_back', src: 'assets/card_back.png' });

    // Table and UI
    manifest.push({ alias: 'table', src: 'assets/table1.png' });
    manifest.push({ alias: 'table2', src: 'assets/table2.png' });
    manifest.push({ alias: 'dealer_button', src: 'assets/dealer_button.png' });
    manifest.push({ alias: 'start_screen', src: 'assets/start_screen.png' });
    manifest.push({ alias: 'white', src: 'assets/white.png' });

    // Load all textures
    for (const item of manifest) {
      Assets.add(item);
    }

    const aliases = manifest.map(m => m.alias);
    await Assets.load(aliases, onProgress);

    this.loaded = true;
    console.log(`AssetManager: loaded ${manifest.length} textures`);
  }

  /** Get a card face texture by rank and suit */
  static getCardTexture(rank: string, suit: string): Texture {
    return Assets.get(`card_${rank}_${suit}`);
  }

  /** Get the card back texture */
  static getCardBack(): Texture {
    return Assets.get('card_back');
  }

  /** Get a named texture */
  static get(alias: string): Texture {
    return Assets.get(alias);
  }
}
