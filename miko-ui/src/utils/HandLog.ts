// (c) 2026 MiraNova Studios
/**
 * HandLog — records per-hand data for post-hand debugging.
 * Call debugHandLog(handNum) in the browser console to view a hand summary.
 */

import type { Card as EngineCard } from '@engine/index.js';

interface HandAction {
  street: string;
  player: string;
  action: string;
  amount?: number;
  allIn?: boolean;
}

interface HandPotAward {
  potLabel: string;
  amount: number;
  winners: string[];
  hand: string;
}

interface ShowdownEntry {
  player: string;
  cards: string;
  hand: string;
}

interface HandRecord {
  handNum: number;
  startStacks: Map<string, number>;
  endStacks: Map<string, number>;
  actions: HandAction[];
  communityCards: Map<string, string>;  // street → formatted cards
  showdown: ShowdownEntry[];
  potAwards: HandPotAward[];
  mainPot: number;
  sidePots: { label: string; amount: number }[];
  foldWin: boolean;
}

function formatCard(c: EngineCard): string {
  const suitChar: Record<string, string> = {
    spades: 's', hearts: 'h', diamonds: 'd', clubs: 'c',
  };
  return `${c.rank}${suitChar[c.suit] ?? '?'}`;
}

function formatCards(cards: EngineCard[]): string {
  return cards.map(formatCard).join(' ');
}

/** Convert engine ID ("player", "ai1") to log name ("Player", "ai1") */
function logName(engineId: string): string {
  return engineId === 'player' ? 'Player' : engineId;
}

export class HandLog {
  private hands: Map<number, HandRecord> = new Map();
  private current: HandRecord | null = null;
  private currentStreet = 'preflop';
  /** Track each player's last recorded street bet to compute incremental amounts */
  private lastBet: Map<string, number> = new Map();

  /** stacks map uses engine IDs ("player", "ai1", etc.) */
  startHand(handNum: number, stacks: Map<string, number>): void {
    const namedStacks = new Map<string, number>();
    stacks.forEach((chips, id) => namedStacks.set(logName(id), chips));
    this.current = {
      handNum,
      startStacks: namedStacks,
      endStacks: new Map(),
      actions: [],
      communityCards: new Map(),
      showdown: [],
      potAwards: [],
      mainPot: 0,
      sidePots: [],
      foldWin: false,
    };
    this.currentStreet = 'preflop';
    this.lastBet.clear();
  }

  recordBlind(engineId: string, amount: number, isAnte?: boolean): void {
    if (!this.current) return;
    const label = isAnte ? 'ante' : 'blind';
    // Track cumulative blind bet per player (BB may post SB + BB + ante)
    const prev = this.lastBet.get(engineId) ?? 0;
    this.lastBet.set(engineId, prev + amount);
    this.current.actions.push({ street: 'preflop', player: logName(engineId), action: label, amount });
  }

  /**
   * Record a player action with the actual incremental chips put in.
   * @param streetBet - player's total bet for this street AFTER the action (from engine state)
   * @param isAllIn - whether the player is now all-in
   */
  recordAction(engineId: string, action: string, streetBet: number, isAllIn: boolean): void {
    if (!this.current) return;
    const prevBet = this.lastBet.get(engineId) ?? 0;
    const chips = streetBet - prevBet;
    this.lastBet.set(engineId, streetBet);
    const amount = chips > 0 ? chips : undefined;
    this.current.actions.push({
      street: this.currentStreet,
      player: logName(engineId),
      action: isAllIn && action !== 'fold' && action !== 'check' ? 'allin' : action,
      amount,
      allIn: isAllIn || undefined,
    });
  }

  recordStreet(street: string, cards: EngineCard[]): void {
    if (!this.current) return;
    this.currentStreet = street;
    this.current.communityCards.set(street, formatCards(cards));
    this.lastBet.clear();
  }

  recordShowdown(engineId: string, cards: EngineCard[], handName: string): void {
    if (!this.current) return;
    this.current.showdown.push({
      player: logName(engineId),
      cards: formatCards(cards),
      hand: handName,
    });
  }

  /** winners should be engine IDs */
  recordPotAward(potLabel: string, amount: number, winnerIds: string[], handName: string): void {
    if (!this.current) return;
    this.current.potAwards.push({ potLabel, amount, winners: winnerIds.map(logName), hand: handName });
  }

  recordPots(mainPot: number, sidePots: { label: string; amount: number }[]): void {
    if (!this.current) return;
    this.current.mainPot = mainPot;
    this.current.sidePots = sidePots;
  }

  /** endStacks map uses engine IDs */
  endHand(endStacks: Map<string, number>, foldWin: boolean): void {
    if (!this.current) return;
    const namedStacks = new Map<string, number>();
    endStacks.forEach((chips, id) => namedStacks.set(logName(id), chips));
    this.current.endStacks = namedStacks;
    this.current.foldWin = foldWin;
    this.hands.set(this.current.handNum, this.current);
    this.current = null;
  }

  getLog(handNum: number): string {
    const hand = this.hands.get(handNum);
    if (!hand) return `Hand #${String(handNum).padStart(3, '0')} not found.`;

    const hNum = String(hand.handNum).padStart(3, '0');
    const lines: string[] = [];
    lines.push(`=== Hand #${hNum} ===`);
    lines.push('');

    // Group actions by street
    const streets = ['preflop', 'flop', 'turn', 'river'];
    for (const street of streets) {
      const streetActions = hand.actions.filter(a => a.street === street);
      if (streetActions.length === 0) continue;

      const cc = hand.communityCards.get(street);
      const header = cc ? `--- ${street.charAt(0).toUpperCase() + street.slice(1)} [${cc}] ---` :
        `--- ${street.charAt(0).toUpperCase() + street.slice(1)} ---`;
      lines.push(header);

      for (const a of streetActions) {
        const amt = a.amount != null ? ` ${a.amount}` : '';
        lines.push(`  ${a.player} ${a.action}${amt}`);
      }

      lines.push('');
    }

    // Showdown
    if (hand.showdown.length > 0) {
      lines.push('--- Showdown ---');
      for (const s of hand.showdown) {
        lines.push(`  ${s.player}: [${s.cards}] — ${s.hand}`);
      }
      lines.push('');
    }

    // Pots
    lines.push('--- Pots ---');
    lines.push(`  Main Pot: ${hand.mainPot}`);
    for (const sp of hand.sidePots) {
      lines.push(`  ${sp.label}: ${sp.amount}`);
    }
    lines.push('');

    // Awards
    lines.push('--- Awards ---');
    if (hand.potAwards.length > 0) {
      for (const a of hand.potAwards) {
        const names = a.winners.join(', ');
        lines.push(`  ${names} wins ${a.amount} (${a.potLabel}) — ${a.hand}`);
      }
    }
    lines.push('');

    // Stacks (only players who were in the hand at showdown or had actions)
    const involvedPlayers = new Set<string>();
    for (const a of hand.actions) {
      if (a.action !== 'blind' && a.action !== 'ante') {
        involvedPlayers.add(a.player);
      }
    }
    // Also include anyone who posted blinds
    for (const a of hand.actions) {
      involvedPlayers.add(a.player);
    }

    lines.push('--- Stacks ---');
    for (const player of involvedPlayers) {
      const start = hand.startStacks.get(player);
      const end = hand.endStacks.get(player);
      if (start == null || end == null) continue;
      const diff = end - start;
      const sign = diff >= 0 ? '+' : '';
      lines.push(`  ${player}: ${start} → ${end} (${sign}${diff})`);
    }

    return lines.join('\n');
  }

  /** Parse flexible hand number input: 5, "5", "005" all → 5 */
  static parseHandNum(input: number | string): number {
    return typeof input === 'string' ? parseInt(input, 10) : input;
  }
}
