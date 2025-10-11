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
   * Collect bets from all players and create side pots if needed
   */
  collectBets(players: Player[]): void {
    // Get all players with bets
    const playersWithBets = players.filter(p => p.bet > 0);
    if (playersWithBets.length === 0) return;

    // Sort by bet amount
    playersWithBets.sort((a, b) => a.bet - b.bet);

    let previousBetLevel = 0;

    for (let i = 0; i < playersWithBets.length; i++) {
      const currentPlayer = playersWithBets[i];
      const currentBetLevel = currentPlayer.bet;
      const betIncrement = currentBetLevel - previousBetLevel;

      if (betIncrement > 0) {
        // Calculate eligible players (those who bet at least this much and haven't folded)
        const eligiblePlayers = players
          .filter(p => !p.folded && p.totalBet >= currentBetLevel)
          .map(p => p.id);

        // Collect this level from all remaining players
        let potAmount = 0;
        for (const player of playersWithBets) {
          if (player.bet >= currentBetLevel) {
            potAmount += betIncrement;
          }
        }

        // If this is the first pot and no all-ins involved, add to main pot
        if (this.sidePots.length === 0 && !currentPlayer.allIn) {
          this.mainPot += potAmount;
        } else {
          // Create side pot
          if (potAmount > 0) {
            this.sidePots.push({
              amount: potAmount,
              eligiblePlayers
            });
          }
        }
      }

      previousBetLevel = currentBetLevel;
    }

    // If we only have main pot and no side pots, collect all bets into main pot
    if (this.sidePots.length === 0) {
      const total = playersWithBets.reduce((sum, p) => sum + p.bet, 0);
      this.mainPot += total;
    }

    // Reset all player bets for next street
    for (const player of players) {
      player.resetBetForStreet();
    }
  }

  /**
   * Simple version: just add all bets to main pot
   * (For basic implementation without side pot complexity)
   */
  collectBetsSimple(players: Player[]): void {
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
   * Award main pot and side pots to appropriate winners
   */
  awardPots(players: Player[], getWinners: (eligiblePlayers: Player[]) => Player[]): void {
    // Award main pot
    if (this.mainPot > 0) {
      const activePlayers = players.filter(p => !p.folded);
      const winners = getWinners(activePlayers);
      
      if (winners.length > 0) {
        const shareAmount = Math.floor(this.mainPot / winners.length);
        winners.forEach(w => w.addChips(shareAmount));
      }
    }

    // Award each side pot
    for (const sidePot of this.sidePots) {
      const eligiblePlayers = players.filter(p => 
        sidePot.eligiblePlayers.includes(p.id) && !p.folded
      );
      
      if (eligiblePlayers.length > 0) {
        const winners = getWinners(eligiblePlayers);
        if (winners.length > 0) {
          const shareAmount = Math.floor(sidePot.amount / winners.length);
          winners.forEach(w => w.addChips(shareAmount));
        }
      }
    }

    this.reset();
  }
}

