// (c) 2026 MiraNova Studios
/**
 * Player roster — 32 named AI opponents with consistent playstyles.
 *
 * Distribution:
 *   passive  (44%) = 14 players — calling stations, wide VPIP, rarely raises
 *   nit      (19%) =  6 players — rocks, <20% VPIP, only plays premiums
 *   shark    (25%) =  8 players — tight-aggressive, selective but bets hard
 *   maniac   (12%) =  4 players — 50%+ VPIP, bluffs and raises constantly
 */

import type { AIConfig, Playstyle } from '@engine/index.js';
import { getPlaystyleConfig } from '@engine/index.js';

export interface RosterEntry {
  name: string;
  playstyle: Playstyle;
  config: AIConfig;
  /** If set, avatar is generated from this name instead of the player's own name. */
  avatarName?: string;
}

/** Simple deterministic hash for per-player jitter seed. */
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// [name, playstyle, avatarName?] — 14 passive (44%), 6 nit (19%), 8 shark (25%), 4 maniac (12%)
const ROSTER_DATA: [string, Playstyle, string?][] = [
  // --- Passive ---
  ['TiltedGrandma',   'passive'],
  ['LuckyRiver13',    'passive'],
  ['Hiker420',    'passive'],
  ['QuantumCaller',   'passive'],
  ['MiraNova',    'passive'],
  ['CardShark300',    'passive'],
  ['RogueButton',     'passive'],
  ['NeonHeart7',  'passive'],
  ['LadyAllIn',       'passive'],

  // --- Nit ---
  ['LaserMagicka',    'nit'],
  ['SilentGrinder',   'nit'],
  ['GolfGuy9',      'nit'],
  ['StackSniper',     'nit'],
  ['ChipEnchantress',  'nit'],
  ['Athena812',   'nit', 'MountainBiker22'],
  ['gr8Qu33n',   'nit'],
  ['AcePilot99',      'nit'],
  ['MountainBiker22',   'nit', 'Athena812'],
  ['PotBuilderX',     'nit'],
  ['PocketAces',     'nit'],

  // --- Shark ---
  ['GoddessOfWar',      'shark'],
  ['AceHuntress44',     'shark'],
  ['GTO_Samurai',     'shark'],
  ['user_984322',   'shark'],
  ['AceCrusher7',     'shark'],
  ['StackOverflow',   'shark'],
  ['FlopDonkey76',    'shark'],
  ['crypt0zenith',   'shark'],
  ['HappyFish', 'shark'],

  // --- Maniac ---
  ['MaxDegen',  'maniac'],
  ['AllInGoblin',     'maniac'],
  ['UltraSage11',   'maniac'],
  ['JustABot4U2',       'maniac'],
];

/** Full roster with pre-computed AI configs (jittered per player). */
export const PLAYER_ROSTER: RosterEntry[] = ROSTER_DATA.map(([name, playstyle, avatarName]) => ({
  name,
  playstyle,
  config: getPlaystyleConfig(playstyle, nameHash(name)),
  ...(avatarName ? { avatarName } : {}),
}));

/**
 * Pick a random player from the roster, excluding any names in the given set.
 */
export function pickNewPlayer(excludeNames: Set<string>): RosterEntry | null {
  const available = PLAYER_ROSTER.filter(p => !excludeNames.has(p.name));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}
