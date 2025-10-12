# MikoPoker Project Structure

## Overview

MikoPoker is a Texas Hold'em poker game with a clean separation between game logic (engine) and UI (Cocos Creator).

```
MikoPoker/
├── engine/              # Pure TypeScript poker engine (UI-agnostic)
│   ├── src/            # Source code
│   ├── dist/           # Compiled JavaScript (built by npm run build)
│   ├── tests/          # Test files
│   └── examples/       # Usage examples
├── MikoPokerUI/        # Cocos Creator UI project
│   └── assets/
│       ├── resources/  # Card images, table graphics
│       └── scripts/    # UI scripts that call the engine
└── MikoPokerFirstTry/  # Reference: old implementation
```

## Engine Architecture

The engine is organized into modular components:

### Core Types (`types.ts`)
- Card, Suit, Rank
- PlayerAction (fold, check, call, bet, raise, allin)
- PlayerState, GameConfig
- Street (preflop, flop, turn, river, showdown)

### Deck Management (`deck.ts`)
- 52-card deck creation
- Fisher-Yates shuffling
- Deal and burn operations

### Hand Evaluator (`hand-evaluator.ts`)
- Evaluates 5-7 card poker hands
- Returns hand strength with category and kickers
- Handles all hand types including wheel (A-2-3-4-5)
- Compare hands for showdown

### Player (`player.ts`)
- Player state management
- Bet placement and chip tracking
- Fold, all-in status
- Available actions calculation

### Pot Management (`pot.ts`)
- Main pot and side pots
- Collect bets from players
- Award pots to winners

### Betting Round (`betting.ts`)
- Process player actions
- Track current bet and raises
- Determine when betting round is complete

### AI (`ai.ts`)
- Decision-making for computer opponents
- Configurable: aggression, tightness, bluff frequency, skill
- Pre-flop and post-flop strategies
- Hand strength evaluation

### Game Engine (`game-engine.ts`)
- Main orchestrator
- Coordinates all components
- Event system for UI integration
- Public API for game control

## Data Flow

```
UI (Cocos Creator)
    ↓ creates
PokerGameEngine
    ↓ manages
[Deck, Players, Pot, BettingRound, AI]
    ↓ emits
GameEvents (hand_started, cards_dealt, street_changed, etc.)
    ↓ updates
UI displays cards, buttons, labels
    ↓ user clicks
UI calls engine.processAction()
    ↓ updates
Game State
    ↓ emits
More events...
```

## Game Flow

### 1. Initialization
```typescript
const engine = new PokerGameEngine(config);
engine.on((event) => handleEvent(event));
engine.initGame(['player', 'ai']);
```

### 2. Start Hand
```typescript
engine.startNewHand();
// → Emits: hand_started
// → Emits: cards_dealt (x2, one per player)
// → Posts blinds
// → Sets first player to act
```

### 3. Betting Round (Pre-flop)
```typescript
// Player acts
engine.processAction('player', { type: 'call', amount: 10 });
// → Emits: player_action
// → Emits: pot_updated

// AI acts
engine.processAIAction('ai');
// → AI decides action based on hand strength
// → Emits: player_action
// → Emits: pot_updated
```

### 4. Street Advancement
```typescript
// When betting round complete:
// → Collects bets to pot
// → Burns card
// → Deals community cards
// → Emits: street_changed
// → Starts new betting round
```

### 5. Showdown
```typescript
// When river betting complete:
// → Evaluates all hands
// → Determines winner(s)
// → Awards pot
// → Emits: hand_complete with result
```

### 6. Next Hand
```typescript
// → Rotate dealer button
// → Reset for new hand
// → Check if game over (one player out of chips)
```

## Integration Points

### UI → Engine
- `engine.initGame(playerIds)` - Start game
- `engine.startNewHand()` - Deal new hand
- `engine.processAction(playerId, action)` - Player acts
- `engine.processAIAction(playerId)` - AI acts
- `engine.getGameState()` - Get current state
- `engine.getPlayers()` - Get all players
- `engine.getCommunityCards()` - Get board cards

### Engine → UI (Events)
- `hand_started` - New hand begins
- `cards_dealt` - Cards dealt to player
- `street_changed` - Flop/turn/river dealt
- `player_action` - Someone acted
- `pot_updated` - Pot size changed
- `hand_complete` - Hand finished with result
- `game_over` - Game finished

## Configuration

### Game Config
```typescript
{
  smallBlind: number;      // Small blind amount (default: 5)
  bigBlind: number;        // Big blind amount (default: 10)
  startingChips: number;   // Starting stack (default: 1000)
  maxPlayers: number;      // Max players (default: 2)
  minRaise: number;        // Min raise increment (default: 10)
}
```

### AI Config
```typescript
{
  aggression: 0-1;         // How aggressive (default: 0.5)
  tightness: 0-1;          // How selective (default: 0.5)
  bluffFrequency: 0-1;     // How often to bluff (default: 0.2)
  skill: 0-1;              // Overall skill (default: 0.7)
}
```

## State Management

### Game State
- `street` - Current street (preflop/flop/turn/river/showdown)
- `pot` - Current pot size
- `communityCards` - Board cards
- `players` - All player states
- `currentPlayerIndex` - Who acts next
- `dealerIndex` - Dealer button position
- `canCheck/canBet/canCall/canRaise/canFold` - Available actions
- `callAmount/minRaiseAmount/minBetAmount` - Action amounts

### Player State
- `id` - Player identifier
- `chips` - Remaining chips
- `bet` - Current bet this street
- `totalBet` - Total bet this hand
- `folded` - Has folded
- `allIn` - Is all-in
- `cards` - Hole cards
- `isDealer` - Has dealer button
- `isActive` - Still in hand

## Testing

### Unit Tests
- Deck operations (shuffle, deal)
- Hand evaluation (all hand types)
- Hand comparison
- Player actions
- Betting rounds
- Game flow

### Integration Tests
- Complete hands
- Multiple streets
- AI decisions
- Event emissions

### Run Tests
```bash
cd engine
npm test
```

## Development Workflow

### Building the Engine
```bash
cd engine
npm install       # Install dependencies
npm run build     # Compile TypeScript
npm test          # Run tests
```

### Using in Cocos Creator
1. Build the engine first
2. Import from `../../engine/dist/index.js` in your scripts
3. Create UI components
4. Wire up buttons to engine actions
5. Subscribe to events to update UI

## Next Steps

### Phase 1: Core Engine ✅ (Complete)
- [x] Card and deck system
- [x] Hand evaluation
- [x] Player management
- [x] Betting system
- [x] Pot management
- [x] Basic AI
- [x] Game engine
- [x] Tests
- [x] Documentation

### Phase 2: UI Integration (In Progress)
- [ ] Create Cocos scene
- [ ] Card display components
- [ ] Button handlers
- [ ] Label updates
- [ ] Animations
- [ ] Sound effects

### Phase 3: Polish
- [ ] Advanced AI
- [ ] Multiple difficulty levels
- [ ] Statistics tracking
- [ ] Hand history
- [ ] Replay system
- [ ] Tutorial mode

### Phase 4: Multiplayer
- [ ] Network architecture
- [ ] Server integration
- [ ] Lobby system
- [ ] Chat
- [ ] Tournaments

## Resources

### Card Images
Located in `MikoPokerUI/assets/resources/cards/`
- Format: `card_[suit]_[rank].png`
- Suits: spades, hearts, diamonds, clubs
- Ranks: A, K, Q, J, 10, 09, 08, ..., 02
- Also: `card_back.png`

### Table Graphics
Located in `MikoPokerUI/assets/resources/`
- `long poker table.png` - Main table image

## References

- Old implementation: `MikoPokerFirstTry/`
- Engine README: `engine/README.md`
- Integration guide: `engine/INTEGRATION.md`
- Example usage: `engine/examples/basic-game.ts`

## Notes

- Engine is UI-agnostic and can work with any framework
- All game logic is in the engine for testability
- UI only handles display and user input
- Events drive UI updates for clean separation
- TypeScript provides type safety throughout

