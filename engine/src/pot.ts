// (c) 2025 MiraNova Studios
/**
 * Pot management including side pots.
 *
 * Tracks per-player contributions across all streets so that pot layers
 * (main pot + side pots) can be computed on demand at any point during
 * a hand — not only at showdown.
 */

import type { Player } from './player.js';

export interface PotInfo {
  amount: number;
  eligiblePlayers: string[]; // player IDs
}

/** Result of awarding a single pot layer. */
export interface PotAwardResult {
  potIndex: number;  // 0 = main pot, 1+ = side pots
  amount: number;
  winnerIds: string[];
}

/** Internal record of a player's cumulative contribution and fold status. */
interface ContributionRecord {
  totalBet: number;
  folded: boolean;
}

export class PotManager {
  /** Running total of chips collected into the pot (for fast getTotalPot). */
  private totalCollected: number;

  /** Per-player contribution tracking, updated each time collectBets is called. */
  private contributions: Map<string, ContributionRecord>;

  /** Player IDs who already received uncontested pot awards (skipped in awardPots). */
  private preAwardedPlayerIds: Set<string> = new Set();

  constructor() {
    this.totalCollected = 0;
    this.contributions = new Map();
    this.preAwardedPlayerIds = new Set();
  }

  /**
   * Reset pot for new hand
   */
  reset(): void {
    this.totalCollected = 0;
    this.contributions.clear();
    this.preAwardedPlayerIds.clear();
  }

  /**
   * Get total pot size
   */
  getTotalPot(): number {
    return this.totalCollected;
  }

  /**
   * Get main pot amount (the first / lowest pot layer).
   */
  getMainPot(): number {
    const layers = this.computeLayers();
    if (layers.length > 0) return layers[0].amount;
    return this.totalCollected;
  }

  /**
   * Get all pot layers (main pot + side pots).
   * Returns an array where index 0 is the main pot and subsequent entries
   * are side pots in ascending contribution order. Each entry includes
   * the pot amount and the IDs of non-folded players eligible to win it.
   *
   * This can be called at any point during a hand to get the current
   * pot structure based on contributions collected so far.
   */
  getSidePots(): PotInfo[] {
    return this.computeLayers();
  }

  /**
   * Collect bets from all players into the pot.
   * Before collecting, returns any uncalled bet portion to the bettor.
   * If one player bet more than any other active player matched,
   * the unmatched excess is returned (standard poker rule).
   *
   * Also updates per-player contribution records so that getSidePots()
   * returns accurate layer information during gameplay.
   */
  collectBets(players: Player[]): void {
    // Return uncalled bet: find the highest bet that was matched by 2+ players
    const activePlayers = players.filter(p => !p.folded);
    if (activePlayers.length >= 2) {
      const sortedBets = activePlayers.map(p => p.bet).sort((a, b) => b - a);
      const highestBet = sortedBets[0];
      const secondHighest = sortedBets[1];
      if (highestBet > secondHighest) {
        const excess = highestBet - secondHighest;
        const topBettor = activePlayers.find(p => p.bet === highestBet);
        if (topBettor) {
          topBettor.chips += excess;
          topBettor.bet -= excess;
          topBettor.totalBet -= excess;
          // Player is no longer all-in if they got chips back
          if (topBettor.chips > 0 && topBettor.allIn) {
            topBettor.allIn = false;
          }
        }
      }
    }

    let total = 0;
    for (const player of players) {
      total += player.bet;
      // Update contribution tracking with latest cumulative state
      this.contributions.set(player.id, {
        totalBet: player.totalBet,
        folded: player.folded,
      });
      player.resetBetForStreet();
    }
    this.totalCollected += total;
  }

  /**
   * Award pot to winner(s) — simple version for fold wins.
   */
  awardPot(winners: Player[]): void {
    if (winners.length === 0) return;

    const shareAmount = Math.floor(this.getTotalPot() / winners.length);
    let remainder = this.getTotalPot() % winners.length;

    for (const winner of winners) {
      let winAmount = shareAmount;
      if (remainder > 0) {
        winAmount += 1;
        remainder -= 1;
      }
      winner.addChips(winAmount);
    }

    this.reset();
  }

  /**
   * Award uncontested pot layers (where only 1 player is eligible).
   * Standard poker rule: side pots with a single eligible player are
   * awarded immediately, not held until showdown.
   * Returns awarded results and removes awarded chips from the pot.
   */
  awardUncontestedLayers(players: Player[]): PotAwardResult[] {
    // Sync contributions
    for (const player of players) {
      this.contributions.set(player.id, {
        totalBet: player.totalBet,
        folded: player.folded,
      });
    }

    const layers = this.computeLayers();
    const results: PotAwardResult[] = [];

    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (layer.eligiblePlayers.length === 1) {
        const winnerId = layer.eligiblePlayers[0];
        const winner = players.find(p => p.id === winnerId);
        if (winner) {
          winner.addChips(layer.amount);
          this.totalCollected -= layer.amount;
          this.preAwardedPlayerIds.add(winnerId);
          results.push({
            potIndex: i,
            amount: layer.amount,
            winnerIds: [winnerId],
          });
        }
      }
    }

    return results;
  }

  /**
   * Award pot(s) to winner(s), using layered side pots built from
   * per-player totalBet contributions.
   *
   * Algorithm: sort contributors by totalBet ascending, then for each
   * contribution level create a pot = increment × number of players who
   * contributed at least that much. Each pot is eligible only to non-folded
   * players at that level. Best hand among eligible wins the pot.
   */
  awardPots(players: Player[], getWinners: (eligiblePlayers: Player[]) => Player[]): PotAwardResult[] {
    // Sync contributions with final player state before computing layers
    for (const player of players) {
      this.contributions.set(player.id, {
        totalBet: player.totalBet,
        folded: player.folded,
      });
    }

    const layers = this.computeLayers();
    const results: PotAwardResult[] = [];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];

      // Skip layers already awarded via awardUncontestedLayers
      // (uncontested layer = 1 eligible player who was already pre-awarded)
      if (layer.eligiblePlayers.length === 1 && this.preAwardedPlayerIds.has(layer.eligiblePlayers[0])) continue;
      // Resolve eligible Player objects for this layer
      const eligible = players.filter(p => layer.eligiblePlayers.includes(p.id));

      let winners: Player[] = [];
      if (eligible.length > 0) {
        winners = getWinners(eligible);
      } else {
        // All eligible players folded — give to any non-folded player
        const nonFolded = players.filter(p => !p.folded);
        if (nonFolded.length > 0) {
          winners = getWinners(nonFolded);
        }
      }

      if (winners.length > 0) {
        const share = Math.floor(layer.amount / winners.length);
        let remainder = layer.amount % winners.length;
        for (const w of winners) {
          let amount = share;
          if (remainder > 0) { amount += 1; remainder--; }
          w.addChips(amount);
        }

        results.push({
          potIndex: i,
          amount: layer.amount,
          winnerIds: winners.map(w => w.id),
        });
      }
    }

    this.reset();
    return results;
  }

  /**
   * Compute pot layers from stored contribution records.
   *
   * Sorts contributors by totalBet ascending and creates one layer per
   * distinct contribution level. Each layer's amount = increment × number
   * of contributors at that level or above.
   */
  private computeLayers(): PotInfo[] {
    const contribs = Array.from(this.contributions.entries())
      .filter(([_, info]) => info.totalBet > 0)
      .sort((a, b) => a[1].totalBet - b[1].totalBet);

    if (contribs.length === 0) return [];

    // Deduplicate contribution levels
    const levels: number[] = [];
    for (const [_, info] of contribs) {
      if (levels.length === 0 || levels[levels.length - 1] !== info.totalBet) {
        levels.push(info.totalBet);
      }
    }

    const rawPots: PotInfo[] = [];
    let previousLevel = 0;

    for (const level of levels) {
      const increment = level - previousLevel;
      if (increment <= 0) continue;

      const numContributors = contribs.filter(([_, info]) => info.totalBet >= level).length;
      const amount = increment * numContributors;

      // Eligible to win = contributed at this level AND not folded
      const eligible = contribs
        .filter(([_, info]) => info.totalBet >= level && !info.folded)
        .map(([id]) => id);

      rawPots.push({ amount, eligiblePlayers: eligible });
      previousLevel = level;
    }

    // Merge adjacent layers with identical eligible players (e.g. folded
    // blind contributions can create extra layers that aren't real side pots)
    const pots: PotInfo[] = [];
    for (const pot of rawPots) {
      const prev = pots[pots.length - 1];
      const sameEligible = prev
        && prev.eligiblePlayers.length === pot.eligiblePlayers.length
        && prev.eligiblePlayers.every(id => pot.eligiblePlayers.includes(id));
      if (sameEligible) {
        prev.amount += pot.amount;
      } else {
        pots.push({ amount: pot.amount, eligiblePlayers: [...pot.eligiblePlayers] });
      }
    }

    return pots;
  }
}
