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

export type Gender = 'male' | 'female';

export interface RosterEntry {
  name: string;
  playstyle: Playstyle;
  config: AIConfig;
  gender: Gender;
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

// [name, playstyle, gender, avatarName?]
const ROSTER_DATA: [string, Playstyle, Gender, string?][] = [
  // --- Passive ---
  ['TiltedGrandma',   'passive', 'female'],
  ['LuckyRiver13',    'passive', 'male'],
  ['Hiker420',        'passive', 'male'],
  ['QuantumCaller',   'passive', 'male'],
  ['MiraNova',        'passive', 'male'],
  ['CardShark300',    'passive', 'male'],
  ['TigerRoute',      'passive', 'male'],
  ['NeonHeart7',      'passive', 'female'],
  ['LadyAllIn',       'passive', 'female'],

  // --- Nit ---
  ['LaserMagicka',    'nit', 'female'],
  ['SilentGrinder',   'nit', 'male'],
  ['GolfGuy9',        'nit', 'male'],
  ['StackSniper',     'nit', 'male'],
  ['ChipEnchantress', 'nit', 'female'],
  ['Athena812',       'nit', 'female'],
  ['Claude',   'nit', 'female'],
  ['AcePilot99',      'nit', 'male'],
  ['MountainBiker22', 'nit', 'male'],
  ['AngelCupcake',    'nit', 'female'],
  ['PocketAces',      'nit', 'male'],

  // --- Shark ---
  ['GoddessOfWar',    'shark', 'female'],
  ['AceHuntress44',   'shark', 'female'],
  ['GTO_Samurai',     'shark', 'male'],
  ['StarWarsFan11',   'shark', 'male'],
  ['ChatGPT',     'shark', 'male'],
  ['StackOverflow',   'shark', 'male'],
  ['FlopDonkey76',    'shark', 'male'],
  ['CryptOfHearts',   'shark', 'male'],
  ['HappyFish',       'shark', 'male'],

  // --- Maniac ---
  ['MaxDegen',        'maniac', 'male'],
  ['AllInGoblin',     'maniac', 'male'],
  ['UltraSage11',     'maniac', 'male'],
  ['JustABot4U2',     'maniac', 'male'],
  ['MikoPoker',         'maniac', 'male', 'preset_male_light']
];

/** Full roster with pre-computed AI configs (jittered per player). */
export const PLAYER_ROSTER: RosterEntry[] = ROSTER_DATA.map(([name, playstyle, gender, avatarName]) => ({
  name,
  playstyle,
  gender,
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
