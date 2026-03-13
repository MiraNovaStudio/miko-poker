// (c) 2026 MiraNova Studios
/**
 * Player roster — 32 named AI opponents with consistent playstyles.
 * AIConfig is derived deterministically from the player name so it never changes.
 * At least 40% of players use a passive style (aggression <= 0.4).
 */

import type { AIConfig } from '@engine/index.js';

export interface RosterEntry {
  name: string;
  config: AIConfig;
}

/**
 * Simple deterministic hash of a string → number 0-1.
 * Used to add small variation within a playstyle archetype.
 */
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 1000) / 1000;
}

/** Small per-player jitter so players in the same archetype aren't identical. */
function jitter(name: string, base: number, range = 0.08): number {
  const v = base + (nameHash(name + 'j') - 0.5) * range * 2;
  return Math.max(0, Math.min(1, v));
}

// --- Archetype definitions ---

type Archetype = 'passive-fish' | 'tight-passive' | 'calling-station' | 'lag' | 'tag' | 'maniac' | 'nit' | 'balanced';

function archetypeConfig(name: string, type: Archetype): AIConfig {
  switch (type) {
    // Passive archetypes (aggression <= 0.4) — at least 40% of roster
    case 'passive-fish':
      return { aggression: jitter(name, 0.2), tightness: jitter(name, 0.3), bluffFrequency: jitter(name, 0.05), skill: jitter(name, 0.25) };
    case 'tight-passive':
      return { aggression: jitter(name, 0.25), tightness: jitter(name, 0.7), bluffFrequency: jitter(name, 0.05), skill: jitter(name, 0.45) };
    case 'calling-station':
      return { aggression: jitter(name, 0.15), tightness: jitter(name, 0.2), bluffFrequency: jitter(name, 0.02), skill: jitter(name, 0.3) };

    // Aggressive archetypes
    case 'lag':
      return { aggression: jitter(name, 0.7), tightness: jitter(name, 0.35), bluffFrequency: jitter(name, 0.3), skill: jitter(name, 0.65) };
    case 'tag':
      return { aggression: jitter(name, 0.65), tightness: jitter(name, 0.65), bluffFrequency: jitter(name, 0.2), skill: jitter(name, 0.7) };
    case 'maniac':
      return { aggression: jitter(name, 0.85), tightness: jitter(name, 0.15), bluffFrequency: jitter(name, 0.4), skill: jitter(name, 0.4) };
    case 'nit':
      return { aggression: jitter(name, 0.4), tightness: jitter(name, 0.85), bluffFrequency: jitter(name, 0.05), skill: jitter(name, 0.55) };
    case 'balanced':
      return { aggression: jitter(name, 0.55), tightness: jitter(name, 0.55), bluffFrequency: jitter(name, 0.18), skill: jitter(name, 0.6) };
  }
}

// Each entry: [name, archetype]
// 14 passive (44%) + 18 non-passive
const ROSTER_DATA: [string, Archetype][] = [
  // --- Passive (14 players, 44%) ---
  ['TiltedGrandma',   'passive-fish'],
  ['FoldOrCry',       'passive-fish'],
  ['FoldMaster64',    'passive-fish'],
  ['LuckyRiver13',    'passive-fish'],
  ['LuckyFlop420',    'calling-station'],
  ['QuantumCaller',   'calling-station'],
  ['PocketNinjas',    'calling-station'],
  ['CardShark300',    'calling-station'],
  ['RiverGhost',      'tight-passive'],
  ['SilentGrinder',   'tight-passive'],
  ['TurnTactician',   'tight-passive'],
  ['AcePilot99',      'tight-passive'],
  ['NeonChipRunner',  'tight-passive'],
  ['RogueButton',     'calling-station'],

  // --- Aggressive / Skilled (18 players, 56%) ---
  ['RiverBandit77',   'lag'],
  ['SolverMode',      'tag'],
  ['BluffingBanana',  'maniac'],
  ['AceHunter42',     'tag'],
  ['NeuralBluffer',   'lag'],
  ['ChipStackMage',   'balanced'],
  ['GTO_Samurai',     'tag'],
  ['DeepStackHero',   'balanced'],
  ['BotDealer9000',   'tag'],
  ['VarianceKnight',  'lag'],
  ['FlopWizard88',    'balanced'],
  ['AllInGoblin',     'maniac'],
  ['StackSniper',     'nit'],
  ['RiverRaptor',     'lag'],
  ['AceCrusher7',     'tag'],
  ['BluffBotX',       'lag'],
  ['PotBuilderX',     'balanced'],
  ['StackOverlord',   'tag'],
];

/** Full roster with pre-computed AI configs. */
export const PLAYER_ROSTER: RosterEntry[] = ROSTER_DATA.map(([name, archetype]) => ({
  name,
  config: archetypeConfig(name, archetype),
}));

/**
 * Pick a random player from the roster, excluding any names in the given set.
 * Uses a deterministic shuffle seeded by the set size so replacement order
 * is reproducible within a session.
 */
export function pickNewPlayer(excludeNames: Set<string>): RosterEntry | null {
  const available = PLAYER_ROSTER.filter(p => !excludeNames.has(p.name));
  if (available.length === 0) return null;
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}
