# MikoPoker Engine

Pure TypeScript Texas Hold'em poker engine - UI-agnostic game logic.

## Features

- ✅ Complete Texas Hold'em rules implementation
- ✅ Hand evaluation (all poker hands including straight flush, quads, etc.)
- ✅ Betting rounds with proper blinds, raises, all-ins
- ✅ Pot management (main pot and side pots)
- ✅ Built-in AI opponent with configurable difficulty
- ✅ Event system for UI integration
- ✅ TypeScript with full type safety
- ✅ Zero UI dependencies - works with any framework
- ✅ Comprehensive test suite

## Installation

```bash
npm install
npm run build
```

## Quick Start

```typescript
import { PokerGameEngine } from '@miko/engine';

// Create engine
const engine = new PokerGameEngine({
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000
});

// Listen to events
engine.on((event) => {
  console.log(event);
});

// Initialize game
engine.initGame(['player1', 'player2']);

// Start hand
engine.startNewHand();

// Get game state
const state = engine.getGameState();

// Process player action
engine.processAction('player1', { type: 'call', amount: 10 });

// Let AI make decision
engine.processAIAction('player2');
```

## API Reference

### PokerGameEngine

Main game controller.

#### Constructor

```typescript
new PokerGameEngine(config?: {
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  maxPlayers: number;
  minRaise?: number;
})
```

#### Methods

- `initGame(playerIds: string[])` - Initialize game with player IDs
- `startNewHand()` - Start a new hand
- `processAction(playerId: string, action: PlayerAction)` - Process player action
- `processAIAction(playerId: string)` - Let AI decide and process action
- `getGameState()` - Get current game state
- `getPlayers()` - Get all players' states
- `getCommunityCards()` - Get community cards
- `getCurrentStreet()` - Get current street
- `isHandInProgress()` - Check if hand is active
- `on(listener)` - Subscribe to events
- `off(listener)` - Unsubscribe from events

### Player Actions

```typescript
type PlayerAction = 
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call'; amount: number }
  | { type: 'bet'; amount: number }
  | { type: 'raise'; amount: number }
  | { type: 'allin'; amount: number };
```

### Game State

```typescript
interface GameState {
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  pot: number;
  communityCards: Card[];
  players: PlayerState[];
  currentPlayerIndex: number;
  dealerIndex: number;
  canCheck: boolean;
  canBet: boolean;
  canCall: boolean;
  canRaise: boolean;
  canFold: boolean;
  callAmount: number;
  minRaiseAmount: number;
  minBetAmount: number;
}
```

### Events

```typescript
type GameEvent = 
  | { type: 'hand_started' }
  | { type: 'cards_dealt'; playerId: string; cards: Card[] }
  | { type: 'street_changed'; street: Street; communityCards: Card[] }
  | { type: 'player_action'; playerId: string; action: PlayerAction }
  | { type: 'pot_updated'; amount: number }
  | { type: 'hand_complete'; result: GameResult }
  | { type: 'game_over'; winnerId: string };
```

## Hand Evaluation

The engine includes a robust hand evaluator:

```typescript
import { evaluateHand, compareHands } from '@miko/engine';

const cards = [
  { rank: 'A', suit: 'hearts' },
  { rank: 'K', suit: 'hearts' },
  { rank: 'Q', suit: 'hearts' },
  { rank: 'J', suit: 'hearts' },
  { rank: '10', suit: 'hearts' }
];

const hand = evaluateHand(cards);
// { category: 8, kickers: [14] } - Royal Flush!

const comparison = compareHands(hand1, hand2);
// > 0 if hand1 wins, < 0 if hand2 wins, 0 for tie
```

### Hand Categories

- 0: High Card
- 1: One Pair
- 2: Two Pair
- 3: Three of a Kind
- 4: Straight
- 5: Flush
- 6: Full House
- 7: Four of a Kind
- 8: Straight Flush

## AI Configuration

Customize AI behavior:

```typescript
engine.setAIConfig({
  aggression: 0.7,    // 0-1: How aggressive
  tightness: 0.5,     // 0-1: How selective
  bluffFrequency: 0.2, // 0-1: Bluff frequency
  skill: 0.8          // 0-1: Overall skill
});
```

## Integration with Cocos Creator

The engine is designed to be called from Cocos Creator scripts:

```typescript
// In your Cocos Creator script
import { PokerGameEngine } from '../../engine/dist/index.js';

@ccclass('GameController')
export class GameController extends Component {
  private engine: PokerGameEngine;

  start() {
    this.engine = new PokerGameEngine();
    
    // Listen to events and update UI
    this.engine.on((event) => {
      this.handleGameEvent(event);
    });

    this.engine.initGame(['player', 'ai']);
    this.engine.startNewHand();
  }

  onCallButtonClick() {
    const state = this.engine.getGameState();
    const player = state.players[state.currentPlayerIndex];
    
    if (player.id === 'player') {
      this.engine.processAction('player', {
        type: 'call',
        amount: state.callAmount
      });
    }
  }

  handleGameEvent(event) {
    // Update UI based on events
    switch (event.type) {
      case 'street_changed':
        this.updateCommunityCards(event.communityCards);
        break;
      case 'pot_updated':
        this.updatePotLabel(event.amount);
        break;
      // ... handle other events
    }
  }
}
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Architecture

The engine is organized into modular components:

- **types.ts** - Core type definitions
- **deck.ts** - Deck management and shuffling
- **hand-evaluator.ts** - Poker hand evaluation
- **player.ts** - Player state management
- **pot.ts** - Pot and side pot management
- **betting.ts** - Betting round logic
- **ai.ts** - AI decision-making
- **game-engine.ts** - Main orchestrator

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Clean
npm run clean
```

## License

MIT

