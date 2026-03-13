// (c) 2025 MiraNova Studios
/**
 * Pot management including side pots
 */

import type { Player } from './player.js';

export interface PotInfo {
  amount: number;
  eligiblePlayers: string[]; // player IDs
}

export class PotManager {
  private mainPot: number;
  private sidePots: PotInfo[];

  constructor() {
    this.mainPot = 0;
    this.sidePots = [];
  }

  /**
   * Reset pot for new hand
   */
  reset(): void {
    this.mainPot = 0;
    this.sidePots = [];
  }

  /**
   * Get total pot size
   */
  getTotalPot(): number {
    const sideTotal = this.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
    return this.mainPot + sideTotal;
  }

  /**
   * Get main pot amount
   */
  getMainPot(): number {
    return this.mainPot;
  }

  /**
   * Get all side pots
   */
  getSidePots(): PotInfo[] {
    return [...this.sidePots];
  }

  /**
   * Collect bets from all players into the pot.
   * Before collecting, returns any uncalled bet portion to the bettor.
   * If one player bet more than any other active player matched,
   * the unmatched excess is returned (standard poker rule).
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
      player.resetBetForStreet();
    }
    this.mainPot += total;
  }

  /**
   * Award pot to winner(s)
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
   * Award pot(s) to winner(s), building layered side pots from totalBet.
   *
   * Algorithm: sort contributors by totalBet ascending, then for each
   * contribution level create a pot = increment × number of players who
   * contributed at least that much. Each pot is eligible only to non-folded
   * players at that level. Best hand among eligible wins the pot.
   */
  awardPots(players: Player[], getWinners: (eligiblePlayers: Player[]) => Player[]): void {
    // Build layered pots from totalBet
    const contributors = players
      .filter(p => p.totalBet > 0)
      .sort((a, b) => a.totalBet - b.totalBet);

    if (contributors.length === 0) {
      this.reset();
      return;
    }

    // Deduplicate contribution levels
    const levels: number[] = [];
    for (const p of contributors) {
      if (levels.length === 0 || levels[levels.length - 1] !== p.totalBet) {
        levels.push(p.totalBet);
      }
    }

    let previousLevel = 0;
    let awarded = 0;

    for (const level of levels) {
      const increment = level - previousLevel;
      if (increment <= 0) continue;

      // Every contributor who put in at least this level contributes 'increment'
      const numContributors = contributors.filter(p => p.totalBet >= level).length;
      const potAmount = increment * numContributors;

      // Eligible to win = contributed at this level AND not folded
      const eligible = contributors.filter(p => p.totalBet >= level && !p.folded);

      if (eligible.length > 0) {
        const winners = getWinners(eligible);
        if (winners.length > 0) {
          const share = Math.floor(potAmount / winners.length);
          let remainder = potAmount % winners.length;
          for (const w of winners) {
            let amount = share;
            if (remainder > 0) { amount += 1; remainder--; }
            w.addChips(amount);
          }
          awarded += potAmount;
        }
      } else {
        // All eligible players folded — give to any non-folded player
        const nonFolded = players.filter(p => !p.folded);
        if (nonFolded.length > 0) {
          const winners = getWinners(nonFolded);
          if (winners.length > 0) {
            const share = Math.floor(potAmount / winners.length);
            let remainder = potAmount % winners.length;
            for (const w of winners) {
              let amount = share;
              if (remainder > 0) { amount += 1; remainder--; }
              w.addChips(amount);
            }
            awarded += potAmount;
          }
        }
      }

      previousLevel = level;
    }

    this.reset();
  }
}

