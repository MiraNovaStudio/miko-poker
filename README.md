# MikoPoker

A professional Texas Hold'em poker game built with a clean separation between game logic and UI.

## Project Overview

MikoPoker consists of two main components:

1. **Engine** (`engine/`) - Pure TypeScript poker game logic (UI-agnostic)
2. **UI** (`MikoPokerUI/`) - Cocos Creator UI that calls the engine

## Quick Start

### Build the Engine

```bash
cd engine
npm install
npm run build
npm test
```

### Open the UI

1. Open Cocos Creator
2. Open the `MikoPokerUI` project
3. The GameController script is ready in `assets/scripts/`

## Features

### ✅ Complete Poker Engine

- **Full Texas Hold'em Rules**
  - Pre-flop, flop, turn, river, showdown
  - Proper betting with blinds, raises, all-ins
  - Pot management including side pots

- **Hand Evaluation**
  - All poker hands (high card to straight flush)
  - Proper tie-breaking with kickers
  - Handles edge cases (wheel, etc.)

- **AI Opponent**
  - Configurable difficulty (aggression, tightness, bluff frequency)
  - Pre-flop and post-flop strategies
  - Hand strength evaluation

- **Event System**
  - Clean separation between logic and UI
  - Subscribe to game events
  - Reactive UI updates

- **Type Safety**
  - 100% TypeScript
  - Full type definitions
  - IDE autocomplete support

- **Well Tested**
  - 21 unit tests (all passing)
  - Coverage of core functionality
  - Hand evaluation thoroughly tested

### 🚧 UI Integration (Ready to Build)

- Template GameController created
- Card images and table graphics available
- Ready for Cocos Creator scene setup

## Architecture

```
┌─────────────────────────────────────────┐
│         Cocos Creator UI                │
│  (GameController, Card Display, etc.)   │
└──────────────┬──────────────────────────┘
               │ calls methods
               │ subscribes to events
┌──────────────▼──────────────────────────┐
│         Poker Engine (TypeScript)       │
│  ┌──────────────────────────────────┐   │
│  │ PokerGameEngine                  │   │
│  ├──────────────────────────────────┤   │
│  │ • Deck (shuffle, deal)           │   │
│  │ • Hand Evaluator (eval, compare) │   │
│  │ • Player (state, actions)        │   │
│  │ • Pot (main, side pots)          │   │
│  │ • Betting (rounds, validation)   │   │
│  │ • AI (decisions, strategy)       │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Usage Example

```typescript
import { PokerGameEngine } from '../../engine/dist/index.js';

// Create engine
const engine = new PokerGameEngine({
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000
});

// Listen to events
engine.on((event) => {
  switch (event.type) {
    case 'hand_started':
      console.log('New hand!');
      break;
    case 'cards_dealt':
      displayCards(event.cards);
      break;
    case 'street_changed':
      displayCommunityCards(event.communityCards);
      break;
    case 'hand_complete':
      showWinner(event.result);
      break;
  }
});

// Initialize and start
engine.initGame(['player', 'ai']);
engine.startNewHand();

// Player acts
const state = engine.getGameState();
if (state.canCall) {
  engine.processAction('player', {
    type: 'call',
    amount: state.callAmount
  });
}

// AI acts
engine.processAIAction('ai');
```

## Documentation

- **[Engine README](engine/README.md)** - Complete engine API documentation
- **[Integration Guide](engine/INTEGRATION.md)** - How to integrate with Cocos Creator
- **[Project Structure](PROJECT_STRUCTURE.md)** - Detailed architecture overview
- **[Development Notes](NOTES.md)** - Progress tracking and notes

## Project Status

### Phase 1: Core Engine ✅ COMPLETE
- [x] Card and deck system
- [x] Hand evaluation (all hand types)
- [x] Player management
- [x] Betting system with proper validation
- [x] Pot management (main + side pots)
- [x] Modular AI system with difficulty presets
- [x] Game engine orchestration
- [x] Event system
- [x] Game modes (Cash, SNG, Tournament)
- [x] Tournament blinds with antes
- [x] Multiplayer support (2-8 players)
- [x] Comprehensive tests (50+ tests)
- [x] Full documentation with JSDoc

### Phase 2: UI Integration 🚧 READY TO START
- [x] GameController template created
- [ ] Cocos scene setup
- [ ] Card display components
- [ ] Button handlers
- [ ] Animations
- [ ] Sound effects

### Phase 3: Polish 📋 PLANNED
- [ ] Advanced AI difficulty levels
- [ ] Hand history
- [ ] Statistics tracking
- [ ] Tutorial mode
- [ ] Settings menu

### Phase 4: Multiplayer 📋 FUTURE
- [ ] Network architecture
- [ ] Server integration
- [ ] Lobby system
- [ ] Tournaments

## Testing

```bash
cd engine
npm test
```

**Results:**
```
✓ Deck (3 tests)
✓ Hand Evaluator (11 tests)  
✓ Game Engine (6 tests)
✓ AI (1 test)

Test Files  1 passed (1)
     Tests  21 passed (21)
```

## File Structure

```
MikoPoker/
├── engine/                 # Pure TypeScript engine
│   ├── src/               # Source code
│   │   ├── index.ts       # Main exports
│   │   ├── types.ts       # Type definitions
│   │   ├── deck.ts        # Deck management
│   │   ├── hand-evaluator.ts  # Hand evaluation
│   │   ├── player.ts      # Player state
│   │   ├── pot.ts         # Pot management
│   │   ├── betting.ts     # Betting rounds
│   │   ├── ai.ts          # AI opponent
│   │   └── game-engine.ts # Main orchestrator
│   ├── dist/              # Compiled output
│   ├── tests/             # Test suite
│   ├── examples/          # Usage examples
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   └── INTEGRATION.md
├── MikoPokerUI/           # Cocos Creator project
│   └── assets/
│       ├── resources/     # Card images, table graphics
│       └── scripts/       # UI scripts
│           └── GameController.ts
├── MikoPokerFirstTry/     # Reference implementation
├── README.md              # This file
├── PROJECT_STRUCTURE.md   # Architecture details
└── NOTES.md               # Development notes
```

## Requirements

- Node.js 20+
- npm
- Cocos Creator 3.x
- TypeScript 5+

## Development

### Build Engine
```bash
cd engine
npm run build
```

### Run Tests
```bash
cd engine
npm test
```

### Watch Mode
```bash
cd engine
npm run test:watch
```

## Key Features Explained

### Event-Driven Architecture
The engine emits events that the UI listens to. This creates a clean separation where:
- Engine focuses on game rules
- UI focuses on display
- No circular dependencies
- Easy to test

### Type Safety
Full TypeScript types mean:
- Compile-time error checking
- IDE autocomplete
- Self-documenting code
- Easier refactoring

### Modular Design
Each component has a single responsibility:
- `Deck` - Card management
- `HandEvaluator` - Poker logic
- `Player` - Player state
- `Pot` - Money management
- `BettingRound` - Action validation
- `AI` - Decision making
- `GameEngine` - Orchestration

### Comprehensive Testing
Tests cover:
- All hand types
- Hand comparison
- Betting logic
- Game flow
- AI decisions

## Contributing

This is a private project, but contributions from team members are welcome:

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Run tests before committing

## License

Private/Proprietary

## Contact

- Developer: Claude AI
- Design: ChatGPT & Team
- Code Review: Team

---

**Ready to start building the UI!** 🎮♠️♥️♦️♣️
