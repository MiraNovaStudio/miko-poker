// (c) 2026 MiraNova Studios
/**
 * Player roster — 32 named AI opponents with consistent playstyles.
 *
 * Distribution:
 *   passive  (40%) = 13 players — calling stations, wide VPIP, rarely raises
 *   nit      (15%) =  5 players — rocks, <20% VPIP, only plays premiums
 *   shark    (25%) =  8 players — tight-aggressive, selective but bets hard
 *   maniac   (20%) =  6 players — 50%+ VPIP, bluffs and raises constantly
 */

import type { AIConfig, Playstyle } from '@engine/index.js';
import { getPlaystyleConfig } from '@engine/index.js';

export interface RosterEntry {
  name: string;
  playstyle: Playstyle;
  config: AIConfig;
}

/** Simple deterministic hash for per-player jitter seed. */
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// [name, playstyle] — 13 passive, 5 nit, 8 shark, 6 maniac
const ROSTER_DATA: [string, Playstyle][] = [
  // --- Passive (13 = 40.6%) ---
  ['TiltedGrandma',   'passive'],
  ['LuckyRiver13',    'passive'],
  ['LuckyFlop420',    'passive'],
  ['QuantumCaller',   'passive'],
  ['PocketNinjas',    'passive'],
  ['CardShark300',    'passive'],
  ['RogueButton',     'passive'],
  ['NeonChipRunner',  'passive'],
  ['FoldOrCry',       'passive'],
  ['TurnTactician',   'passive'],
  ['AcePilot99',      'passive'],
  ['DeepStackHero',   'passive'],
  ['PotBuilderX',     'passive'],

  // --- Nit (5 = 15.6%) ---
  ['FoldMaster64',    'nit'],
  ['SilentGrinder',   'nit'],
  ['RiverGhost',      'nit'],
  ['StackSniper',     'nit'],
  ['VarianceKnight',  'nit'],

  // --- Shark (8 = 25%) ---
  ['SolverMode',      'shark'],
  ['AceHunter42',     'shark'],
  ['GTO_Samurai',     'shark'],
  ['BotDealer9000',   'shark'],
  ['AceCrusher7',     'shark'],
  ['StackOverlord',   'shark'],
  ['FlopWizard88',    'shark'],
  ['ChipStackMage',   'shark'],

  // --- Maniac (6 = 18.75%) ---
  ['BluffingBanana',  'maniac'],
  ['AllInGoblin',     'maniac'],
  ['RiverBandit77',   'maniac'],
  ['NeuralBluffer',   'maniac'],
  ['BluffBotX',       'maniac'],
  ['RiverRaptor',     'maniac'],
];

/** Full roster with pre-computed AI configs (jittered per player). */
export const PLAYER_ROSTER: RosterEntry[] = ROSTER_DATA.map(([name, playstyle]) => ({
  name,
  playstyle,
  config: getPlaystyleConfig(playstyle, nameHash(name)),
}));

/**
 * Pick a random player from the roster, excluding any names in the given set.
 */
export function pickNewPlayer(excludeNames: Set<string>): RosterEntry | null {
  const available = PLAYER_ROSTER.filter(p => !excludeNames.has(p.name));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}
