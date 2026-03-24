// (c) 2026 MiraNova Studios
import { Assets, Texture } from 'pixi.js';
import { RANK_TO_FILENAME } from '../utils/constants.js';
import { SettingsManager } from './SettingsManager.js';

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
const RANKS = Object.keys(RANK_TO_FILENAME);

export class AssetManager {
  private static loaded = false;
  private static cardPngsLoaded = false;
  private static cardSvgsLoaded = false;

  /** Preload all game textures. Call once at startup. */
  static async load(onProgress?: (progress: number) => void): Promise<void> {
    if (this.loaded) return;

    const manifest: { alias: string; src: string }[] = [];

    // Only load card face PNGs if the user is using the PNG deck
    const deckType = SettingsManager.instance.deckType;
    if (deckType === 'png') {
      for (const rank of RANKS) {
        for (const suit of SUITS) {
          const rankName = RANK_TO_FILENAME[rank];
          const alias = `card_${rank}_${suit}`;
          manifest.push({ alias, src: `assets/cards/${rankName}_of_${suit}.png` });
        }
      }
      this.cardPngsLoaded = true;
    } else if (deckType === 'svg') {
      for (const rank of RANKS) {
        for (const suit of SUITS) {
          const rankName = RANK_TO_FILENAME[rank];
          const alias = `card_svg_${rank}_${suit}`;
          manifest.push({ alias, src: `assets/svg_cards/${rankName}_of_${suit}.svg` });
        }
      }
      this.cardSvgsLoaded = true;
    }

    // Table and UI
    manifest.push({ alias: 'table', src: 'assets/table1.png' });
    manifest.push({ alias: 'table2', src: 'assets/table2.png' });
    manifest.push({ alias: 'dealer_button', src: 'assets/dealer_button.png' });
    manifest.push({ alias: 'start_screen', src: 'assets/start_screen.png' });
    // white.png no longer used — card backs are drawn procedurally

    // Load all textures
    for (const item of manifest) {
      Assets.add(item);
    }

    const aliases = manifest.map(m => m.alias);
    await Assets.load(aliases, onProgress);

    this.loaded = true;
    console.log(`AssetManager: loaded ${manifest.length} textures`);
  }

  /** Load card face PNGs on demand (when user switches to PNG deck mid-game) */
  static async loadCardPngs(): Promise<void> {
    if (this.cardPngsLoaded) return;

    const manifest: { alias: string; src: string }[] = [];
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        const rankName = RANK_TO_FILENAME[rank];
        const alias = `card_${rank}_${suit}`;
        manifest.push({ alias, src: `assets/cards/${rankName}_of_${suit}.png` });
      }
    }

    for (const item of manifest) {
      Assets.add(item);
    }
    await Assets.load(manifest.map(m => m.alias));
    this.cardPngsLoaded = true;
    console.log('AssetManager: loaded 52 card PNG textures on demand');
  }

  /** Load card face SVGs on demand (when user switches to SVG deck mid-game) */
  static async loadCardSvgs(): Promise<void> {
    if (this.cardSvgsLoaded) return;

    const manifest: { alias: string; src: string }[] = [];
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        const rankName = RANK_TO_FILENAME[rank];
        const alias = `card_svg_${rank}_${suit}`;
        manifest.push({ alias, src: `assets/svg_cards/${rankName}_of_${suit}.svg` });
      }
    }

    for (const item of manifest) {
      Assets.add(item);
    }
    await Assets.load(manifest.map(m => m.alias));
    this.cardSvgsLoaded = true;
    console.log('AssetManager: loaded 52 card SVG textures on demand');
  }

  /** Get a card face texture by rank and suit */
  static getCardTexture(rank: string, suit: string): Texture {
    return Assets.get(`card_${rank}_${suit}`);
  }

  /** Get a card SVG texture by rank and suit */
  static getSvgCardTexture(rank: string, suit: string): Texture {
    return Assets.get(`card_svg_${rank}_${suit}`);
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
