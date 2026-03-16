// (c) 2025 MiraNova Studios
/**
 * Debug logging utility for the poker engine
 * Set DEBUG_ENABLED to true to enable detailed logging
 */

export let DEBUG_ENABLED = false; // Toggled at runtime via window.debugLogs()

/** Enable or disable debug logging at runtime */
export function setDebugEnabled(enabled: boolean): void {
  DEBUG_ENABLED = enabled;
}

/**
 * Log debug message if debug is enabled
 */
export function debugLog(category: string, message: string, data?: any): void {
  if (!DEBUG_ENABLED) return;

  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const prefix = `[${timestamp}] [${category}]`;

  if (data !== undefined) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * Log betting round state
 */
export function debugBettingState(
  currentBet: number,
  players: Array<{ id: string; bet: number; chips: number; folded: boolean; allIn: boolean }>,
  currentPlayerIndex: number
): void {
  if (!DEBUG_ENABLED) return;

  console.log('═══════════════════════════════════════════════════════');
  console.log(' BETTING STATE:');
  console.log(` Current Bet: $${currentBet}`);
  console.log(` Current Player Index: ${currentPlayerIndex}`);
  console.log(' Players:');
  players.forEach((p, idx) => {
    const marker = idx === currentPlayerIndex ? '(current)' : '         ';
    const status = p.folded ? '[FOLDED]' : p.allIn ? '[ALL-IN]' : '[ACTIVE]';
    console.log(`   ${marker} ${idx}. ${p.id.padEnd(10)} ${status.padEnd(10)} Bet: $${p.bet.toString().padStart(4)} Chips: $${p.chips.toString().padStart(4)}`);
  });
  console.log('═══════════════════════════════════════════════════════');
}

