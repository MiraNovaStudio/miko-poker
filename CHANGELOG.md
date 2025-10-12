# Changelog

All notable changes to the MikoPoker project will be documented in this file.

## [UI] - 2025-10-11 22:20

### SlotLayoutManager - Rectangular Layout
- Added rectangular poker table layout (traditional poker table arrangement)
- Layout: 3 top (ai3, ai4, ai5), 2 sides (ai2, ai6), 3 bottom (ai1, human, ai7)
- Added `useRectangularLayout` property (default true)
- Kept elliptical layout code for future use
- Rectangular layout supports 2-max and 8-max

## [UI] - 2025-10-11 22:10

### GameTable UI - Check/Fold Labels
- Enhanced logging for Check/Fold action labels (position, color, font size)
- Verified Check/Fold labels use same system as bet amount labels
- Labels should persist during betting round until street changes

## [UI] - 2025-10-11 22:00

### GameTable UI
- Added SB/BB labels showing "SB $5" and "BB $10" for blind positions
- Added detailed logging for dealer, SB, BB, UTG positions on hand start
- Verified action starts at UTG (Under The Gun) after big blind

## [Engine 0.2.1] - 2025-10-11 21:45

### AI Behavior - Tighter Preflop Play
- AI now folds more often preflop (typical 8-max behavior: 2-4 players per hand)
- Fold any hand < 0.5 strength when facing a bet
- Only bet with premium hands (> 0.75 strength) when no bet to face
- More selective calling: good hands (0.5-0.7) fold if bet > 15% of stack
- No re-raising to prevent infinite betting loops
- AI can bet/raise when no bet is facing them
- AI will only call or fold when facing a bet (no re-raises)

## [UI] - 2025-10-11 21:30

### GameTable UI - Pot Logic Fix
- Fixed pot/outstanding/total tracking to follow proper poker rules
- Pot now only updates when betting round completes (not per action)
- Outstanding tracks current bets, resets when moved to pot
- Total always shows Pot + Outstanding in real-time

## [UI] - 2025-10-11 21:15

### GameTable UI
- Bet labels show action text for Check/Fold instead of amounts
- Adjusted top player bet label position (Y=-80) to avoid name/stack overlap

## [UI] - 2025-10-11 21:00

### GameTable UI
- Implemented overlay container system for bet labels (always render on top)
- Smart bet label positioning based on seat location (above/below/sides to avoid card overlap)
- Bet labels now persist for entire betting round, clear on street change
- Active player highlighting: name/chips become bold during their turn

## [Engine 0.2.0] - 2025-10-11

### Added

**Game Modes:**
- Game type system: Cash, Sit & Go, Tournament
- `GameModeManager` class for mode-specific logic
- `BlindStructure` interface with level progression
- 3 standard tournament structures: Turbo, Standard, Deep Stack
- Tournament blind progression with automatic level advancement
- Big blind ante support (BB posts double when ante is active)

**AI System:**
- Refactored AI into modular directory structure (`src/ai/`)
- AI difficulty presets: Easy, Normal, Hard, Pro
- Per-player AI instances (each AI can have different difficulty)
- Separated pre-flop and post-flop decision logic
- Custom AI configuration support

**Events:**
- `blind_posted` - Emitted when blinds/antes are posted
- `level_changed` - Emitted when tournament level advances
- `game_mode_changed` - Emitted when game mode changes

**API:**
- `initGame()` now accepts optional AI difficulty map
- `setAIConfig(playerId, difficulty)` - Change AI difficulty per player
- `getGameMode()` - Access game mode manager
- `GameState.gameType` - Current game type
- `GameState.currentBlindLevel` - Current tournament level

### Changed

**Breaking Changes:**
- AI import path changed from `./ai` to `./ai/PokerAI`
- `setAIConfig()` signature changed to include `playerId` parameter
- `initGame()` signature extended with optional AI difficulties

**Improvements:**
- All public methods now have explicit return types
- Full JSDoc documentation on all public methods
- Betting round clean state verification
- Improved blind handling for heads-up and multiplayer
- Fixed action order for multiplayer games (UTG acts first preflop)

### Fixed
- Multiplayer games (3+ players) now fully supported
- Betting round state properly resets between streets
- Blind positions correctly handled in all game formats
- Spread operator syntax throughout codebase
- Cash game chip persistence verified and working

### Testing
- Added comprehensive test suite (23 new tests)
- Tests for blind handling in all formats
- Tests for tournament ante mechanics
- Tests for cash game chip persistence
- Tests for multiplayer simulations
- Tests for AI difficulty presets

### Documentation
- Updated README with new features
- Added `REMEDIATION_SUMMARY.md` with all changes
- Added `MULTIPLAYER_GUIDE.md` for multiplayer setup
- Added `SLOT_POSITIONS.md` for UI positioning
- Added inline JSDoc comments to all public APIs

---

## [0.1.0] - 2025-10-11 (Initial Release)

### Added
- Core Texas Hold'em poker engine
- Hand evaluation for all poker hands
- Deck management with shuffling
- Player state management
- Pot management with side pots
- Betting round logic
- AI opponent with basic strategy
- Event system for UI integration
- TypeScript with full type safety
- Initial test suite (27 tests)
- Documentation and integration guides

---

## Migration Guide: v0.1.0 → v0.2.0

### Import Changes

```typescript
// OLD
import { PokerAI } from '@miko/engine';

// NEW
import { PokerAI } from '@miko/engine';  // Still works, exported from index
// OR
import { PokerAI } from '@miko/engine/ai/PokerAI';  // Direct import
```

### API Changes

```typescript
// OLD: initGame
engine.initGame(['player', 'ai1', 'ai2']);

// NEW: initGame with AI difficulties (optional)
const aiDifficulties = new Map([
  ['ai1', 'easy'],
  ['ai2', 'pro']
]);
engine.initGame(['player', 'ai1', 'ai2'], aiDifficulties);

// OLD: setAIConfig (global)
engine.setAIConfig({ aggression: 0.8 });

// NEW: setAIConfig (per-player)
engine.setAIConfig('ai1', 'pro');
```

### New Features to Adopt

```typescript
// Use game modes
const tournament = new PokerGameEngine({
  gameType: 'tournament',
  blindStructure: 'turbo'
});

// Listen to new events
engine.on((event) => {
  if (event.type === 'blind_posted') {
    console.log(`Blind: $${event.amount}`);
  }
  if (event.type === 'level_changed') {
    console.log(`Level ${event.level}`);
  }
});

// Access game mode
const gameMode = engine.getGameMode();
console.log(`Current blinds: ${gameMode.getSmallBlind()}/${gameMode.getBigBlind()}`);
```

### Backward Compatibility

Most v0.1.0 code will continue to work without changes:
- Default game type is 'cash' (same as before)
- AI still works without specifying difficulties (defaults to 'normal')
- All original events still fire
- All original API methods still available

Only breaking changes are in AI import paths and advanced AI configuration.
