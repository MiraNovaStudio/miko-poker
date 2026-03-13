# MikoPoker

A professional Texas Hold'em poker game built with a clean separation between game logic and UI.

## Project Overview

MikoPoker consists of two main components:

1. **Engine** (`engine/`) - Pure TypeScript poker game logic (UI-agnostic)
2. **UI** (`miko-ui/`) - PixiJS v8 browser-based UI with Vite

## Quick Start

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev          # Vite dev server on http://localhost:3000
```

### Production Build & Serve

```bash
npm run build        # builds engine → UI → deploys to public/
npm run serve        # serves public/ on http://localhost:9001
```

### Run Tests

```bash
npm test             # engine unit tests
```

## Features

### Complete Poker Engine

- **Full Texas Hold'em Rules** - Pre-flop, flop, turn, river, showdown
- **Proper Betting** - Blinds, raises, all-ins, side pots
- **Hand Evaluation** - All poker hands with tie-breaking and kickers
- **AI Opponents** - Configurable difficulty (aggression, tightness, bluff frequency)
- **Event System** - Clean separation between logic and UI via observer pattern
- **Type Safety** - 100% TypeScript with full type definitions

### PixiJS Browser UI

- **PixiJS v8** - WebGPU-ready canvas rendering
- **Responsive Layout** - Aspect-ratio scaling (960x720 design resolution)
- **8-Max Table** - Rectangular poker table with 8 player seats
- **Card Rendering** - 52-card sprite deck with flip animations
- **Sound Effects** - Web Audio API for check, bet, fold sounds + background music
- **HTML Bet Input** - Overlay input positioned via canvas transform
- **Start Screen** - Splash screen before entering the game

## Architecture

```
┌─────────────────────────────────────────┐
│         PixiJS Browser UI              │
│  (GameScene, ActionBar, PlayerSlot)    │
└──────────────┬──────────────────────────┘
               │ imports @engine
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

## Engine Events

The engine emits these events that the UI subscribes to:

| Event | Description |
|-------|-------------|
| `hand_started` | New hand begins |
| `cards_dealt` | Hole cards dealt to players |
| `street_changed` | Community cards revealed (flop/turn/river) |
| `player_action` | A player acts (bet, call, fold, etc.) |
| `pot_updated` | Pot amount changes |
| `blind_posted` | Blind or ante posted |
| `hand_complete` | Hand finishes with results |
| `game_over` | Tournament/game ends |

## Usage Example

```typescript
import { PokerGameEngine } from '@engine/index.js';

const engine = new PokerGameEngine({
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000
});

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

engine.initGame(['player', 'ai1', 'ai2']);
engine.startNewHand();
```

## File Structure

```
MikoPoker/
├── engine/                    # Pure TypeScript poker engine
│   ├── src/                   # Engine source code
│   ├── dist/                  # Compiled output (gitignored)
│   ├── tests/                 # Engine test suite
│   ├── package.json           # @miko/engine
│   └── tsconfig.json
├── miko-ui/                   # PixiJS browser UI
│   ├── src/
│   │   ├── main.ts            # App init, scaling, scene management
│   │   ├── types.ts           # Shared UI types
│   │   ├── scenes/
│   │   │   ├── StartScene.ts  # Splash/start screen
│   │   │   └── GameScene.ts   # Main game table scene
│   │   ├── components/
│   │   │   ├── ActionBar.ts   # Check/Call, Bet/Raise, Fold buttons
│   │   │   ├── Card.ts        # Card sprite with face/back
│   │   │   ├── CommunityCards.ts
│   │   │   ├── DealerButton.ts
│   │   │   ├── PlayerSlot.ts  # Per-player UI (cards, chips, name)
│   │   │   ├── SlotLayout.ts  # 8-seat rectangular layout
│   │   │   └── StatusBar.ts   # Pot/hand info display
│   │   ├── managers/
│   │   │   ├── AssetManager.ts   # Texture preloading
│   │   │   ├── AudioManager.ts   # Web Audio API sounds
│   │   │   └── GameManager.ts    # Engine orchestration (~500 lines)
│   │   └── utils/
│   │       └── constants.ts      # Layout, colors, fonts, config
│   ├── static/                # Static assets (cards, table, sounds)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json           # @miko/ui
├── public/                    # Production deploy target (gitignored)
├── nova/                      # Planning docs
├── build.sh                   # Full build + deploy script
├── package.json               # Root workspace config
├── CHANGELOG.md
└── README.md
```

## Build System

The project uses **npm workspaces** with two packages:

- `@miko/engine` — the poker engine (TypeScript → CommonJS)
- `@miko/ui` — the PixiJS UI (TypeScript → Vite bundle)

The `build.sh` script orchestrates the full pipeline:
1. Build engine (`engine/dist/`)
2. Build UI (`miko-ui/dist/`)
3. Deploy to `public/`

The UI resolves the engine via the `@engine` alias in both `tsconfig.json` (paths) and `vite.config.ts` (resolve.alias), pointing to `../engine/dist`.

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (port 3000) |
| `npm run build` | Full build + deploy to public/ |
| `npm run build:engine` | Build engine only |
| `npm run build:ui` | Build UI only |
| `npm run serve` | Serve public/ on port 9001 |
| `npm test` | Run engine tests |
| `npm run lint` | Lint engine code |

## Requirements

- Node.js 20+
- npm 9+
- TypeScript 5+

## License

See [LICENSE](LICENSE).
