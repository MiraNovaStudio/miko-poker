# DEBUG.md — MikoPoker Debug Features

All debug commands are accessed via the browser console (DevTools → Console).
There are no keyboard shortcuts or UI buttons for debug features.

---

## Console Commands

### `window.debugAces()`
Toggle pocket aces mode. When ON, the player receives pocket Aces (AA) every hand.

- **Toggle**: Calling again turns it OFF
- **How it works**: After cards are dealt, `rigPlayerAces()` swaps the player's hole cards with aces found in other players' hands or the deck. Pure swap — no card duplication.
- **Console output**: `🅰️ Pocket Aces mode: ON` / `OFF`
- **Code**: `GameManager.ts` — `debugAces()` (flag), `rigPlayerAces()` (swap logic)

### `window.debugEndgame()`
Queue an endgame scenario. After the current hand finishes, all AI opponents are eliminated except one, who is left with 20 chips. The player gets 10,000 chips.

- **Deferred**: Activates between hands, not mid-hand
- **Console output**: `🎯 Endgame will activate after the current hand finishes.`
- **Status bar**: `DEBUG: Final opponent — [name]`
- **Code**: `GameManager.ts` — `debugEndgamePending` flag, `applyDebugEndgame()`

### `window.debugClearTable()`
Queue a table clear. After the current hand finishes, ALL AI opponents are eliminated and victory is triggered immediately. Player gets 10,000 chips.

- **Deferred**: Activates between hands, not mid-hand
- **Console output**: `🎯 Table clear will activate after the current hand finishes.`
- **Status bar**: `YOU WIN! All opponents eliminated!`
- **Code**: `GameManager.ts` — `debugClearTablePending` flag, `applyDebugClearTable()`

### `window.debugSetChips(amount)`
Immediately set the player's chip stack to the specified amount.

- **Example**: `window.debugSetChips(5000)`
- **Console output**: `💰 Player chips set to 5000`
- **Code**: `GameManager.ts` — `debugSetChips()`

---

## Engine Debug Logging

### `DEBUG_ENABLED` flag
- **File**: `engine/src/debug.ts`
- **Current state**: `true` (ON)
- **To disable**: Change to `false` and rebuild (`npm run build:engine`)

### Logging functions
- `debugLog(category, message, data?)` — Timestamped `[HH:MM:SS] [CATEGORY] message` output
- `debugBettingState(currentBet, players, currentPlayerIndex)` — ASCII table showing all players' bet/chip/status

### Log categories used in game-engine.ts
| Category | When |
|----------|------|
| `HAND_START` | New hand begins, pot reset |
| `START_ROUND` | Betting round starts, first player to act |
| `ACTION` | Player action processed, active player count |
| `ROUND_CHECK` | Betting round completion checks |
| `END_ROUND` | Bets collected, pot updated |
| `ADVANCE` | Player index advances to next actor |
| `FORCE_COMPLETE` | All-in auto-completion triggered |

---

## File Map

| File | Debug Features |
|------|---------------|
| `miko-ui/src/main.ts` (lines 510-513) | Exposes all 4 console commands on `window` |
| `miko-ui/src/managers/GameManager.ts` | Implements aces rig, endgame rig, clear table, set chips |
| `engine/src/debug.ts` | `DEBUG_ENABLED` flag, `debugLog()`, `debugBettingState()` |
| `engine/src/game-engine.ts` | Uses debug logging throughout hand lifecycle |

---

## Adding New Debug Features

1. Add the method to `GameManager.ts` in the debug section (near the top, after constructor)
2. Expose it on `window` in `main.ts` (around line 510)
3. Document it in this file
