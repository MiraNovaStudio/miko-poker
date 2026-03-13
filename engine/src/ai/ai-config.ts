// (c) 2025 MiraNova Studios
/**
 * AI playstyle configuration.
 *
 * Four archetypes:
 *   passive  (40%) — calling stations, wide VPIP, rarely raises
 *   nit      (15%) — rocks, <20% VPIP, only plays premiums
 *   shark    (25%) — tight-aggressive, selective but bets hard
 *   maniac   (20%) — 50%+ VPIP, bluffs and raises constantly
 */

export type Playstyle = 'passive' | 'nit' | 'shark' | 'maniac';

/**
 * AI configuration — controls decision thresholds directly.
 */
export interface AIConfig {
  playstyle: Playstyle;

  /** Minimum preflop hand strength to voluntarily enter a pot (VPIP threshold).
   *  Lower = looser. passive ~0.35, nit ~0.65, shark ~0.50, maniac ~0.25 */
  vpipThreshold: number;

  /** How often to bet/raise when the AI has initiative (0-1).
   *  Higher = more aggressive. passive ~0.15, nit ~0.2, shark ~0.6, maniac ~0.7 */
  aggression: number;

  /** How often to bluff with weak hands (0-1).
   *  passive ~0.03, nit ~0.02, shark ~0.15, maniac ~0.4 */
  bluffFrequency: number;

  /** Strength threshold to call a bet postflop (lower = calls more).
   *  passive ~0.2, nit ~0.5, shark ~0.4, maniac ~0.15 */
  callThreshold: number;

  /** Strength threshold to value-bet postflop.
   *  passive ~0.8, nit ~0.75, shark ~0.55, maniac ~0.35 */
  valueBetThreshold: number;
}

export const PLAYSTYLE_DEFAULTS: Record<Playstyle, AIConfig> = {
  passive: {
    playstyle: 'passive',
    vpipThreshold: 0.35,
    aggression: 0.15,
    bluffFrequency: 0.03,
    callThreshold: 0.2,
    valueBetThreshold: 0.8,
  },
  nit: {
    playstyle: 'nit',
    vpipThreshold: 0.65,
    aggression: 0.2,
    bluffFrequency: 0.02,
    callThreshold: 0.5,
    valueBetThreshold: 0.75,
  },
  shark: {
    playstyle: 'shark',
    vpipThreshold: 0.50,
    aggression: 0.6,
    bluffFrequency: 0.15,
    callThreshold: 0.4,
    valueBetThreshold: 0.55,
  },
  maniac: {
    playstyle: 'maniac',
    vpipThreshold: 0.25,
    aggression: 0.7,
    bluffFrequency: 0.4,
    callThreshold: 0.15,
    valueBetThreshold: 0.35,
  },
};

/** Get a playstyle config with optional per-player jitter. */
export function getPlaystyleConfig(style: Playstyle, jitterSeed = 0): AIConfig {
  const base = { ...PLAYSTYLE_DEFAULTS[style] };
  if (jitterSeed === 0) return base;

  // Small deterministic variation so players in the same archetype aren't clones
  const j = (v: number, range = 0.06) => {
    const offset = ((jitterSeed * 9301 + 49297) % 233280) / 233280; // 0-1 deterministic
    return Math.max(0, Math.min(1, v + (offset - 0.5) * range * 2));
  };

  base.vpipThreshold = j(base.vpipThreshold, 0.05);
  base.aggression = j(base.aggression, 0.06);
  base.bluffFrequency = j(base.bluffFrequency, 0.04);
  base.callThreshold = j(base.callThreshold, 0.05);
  base.valueBetThreshold = j(base.valueBetThreshold, 0.05);
  return base;
}
