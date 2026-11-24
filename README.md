# MikoPoker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Texas Hold'em in the browser. The rules live in a UI-agnostic TypeScript engine; the table is a PixiJS v8 app. Version **0.6.4**.

## Quick start

`engine/dist` is gitignored, and the UI imports the engine from there. Build the engine once after a fresh clone, and again after any engine change. `npm run dev` does not rebuild it.

```bash
npm install
npm run build:engine
npm run dev             # http://localhost:3000
```

```bash
npm test                # engine tests, then UI tests
npm run build           # engine → UI → public/
npm run serve           # http://localhost:9001
```

| Script | What it does |
|--------|----------------|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Full build, then copy `miko-ui/dist` to `public/` |
| `npm run build:engine` | Compile `@miko/engine` only |
| `npm run build:ui` | Bundle `@miko/ui` only |
| `npm run serve` | Serve `public/` on port 9001 |
| `npm test` | Engine tests, then UI tests |
| `npm run test:engine` | Engine tests only |
| `npm run test:ui` | UI tests only |
| `npm run lint` | Lint the engine |
| `npm run clean` | Delete `engine/dist` |

Production UI builds are minified and obfuscated. The dev server is not.

## Publishing

`./deploy.sh` syncs `public/` to an S3 bucket you create. The bucket name is yours. Copy `deploy.env.example` to `deploy.env`, set `S3_BUCKET`, and run the script. Pass `-i` to invalidate your CloudFront distribution; that asks for `CLOUDFRONT_DISTRIBUTION_ID` when it is not already set. `deploy.env` is gitignored. Details are in `SETUP.md`.

A self-hosted package is also described in `SETUP.md`. The nginx sample uses `poker.example.com` until you replace it.

## Features

**Engine** (`@miko/engine`)

- Hold'em from pre-flop through showdown
- Blinds, raises, all-ins, and side pots
- Hand ranking with tie-breaks and kickers
- Pre-flop and post-flop AI, with playstyles passive, nit, shark, and maniac
- Cash, sit-and-go, and tournament blind structures
- Events the UI can subscribe to, so the rules stay independent of rendering

**UI** (`@miko/ui`)

- PixiJS v8 table, authored at 960 × 720 and scaled to the window
- Eight seats, a 52-card deck with flip animation, and chip stacks
- Web Audio cues for check, bet, fold, and chips, plus background music
- An HTML bet field positioned over the canvas
- 34 named AI opponents with generated avatars
- A collapsible hand history, persisted settings (deck, chip units, table style), and a start screen

## Architecture

The repo is an npm workspace with two packages:

- `@miko/engine` compiles with `tsc` to `engine/dist`
- `@miko/ui` bundles with Vite

The UI does not import engine source. `miko-ui/tsconfig.json` and `miko-ui/vite.config.ts` both alias `@engine` to `../engine/dist`. `npm run build` runs `build.sh`: compile the engine, require `engine/dist/index.js`, bundle the UI, and replace `public/` with `miko-ui/dist`. Card art, the table, and sounds live in `miko-ui/static/` (Vite `publicDir`).

```
UI (StartScene, GameScene, managers)
        │  import @engine
        │  subscribe to GameEvent
        ▼
PokerGameEngine
  deck · betting · pots · hand evaluator · AI · game mode
```

### Engine events

| Event | When it fires |
|-------|----------------|
| `hand_started` | A new hand begins |
| `cards_dealt` | Hole cards are dealt to one player |
| `street_changed` | The flop, turn, or river is revealed |
| `player_action` | A player folds, checks, calls, bets, raises, or goes all-in |
| `pot_updated` | The pot total changes |
| `blind_posted` | A blind or ante is posted |
| `side_pot_awarded` | A side pot is paid out |
| `hand_complete` | The hand ends and a result is available |
| `game_mode_changed` | The game type changes (cash, sit-and-go, or tournament) |
| `level_changed` | The tournament blind level increases |
| `game_over` | The tournament or game ends |

## Usage

Subscribe to events, then start a hand. `cards_dealt` fires once per player. The listener below only logs engine data.

```typescript
import { PokerGameEngine } from '@miko/engine';

const engine = new PokerGameEngine({
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000,
  maxPlayers: 3,
});

engine.on((event) => {
  switch (event.type) {
    case 'hand_started':
      console.log('New hand');
      break;
    case 'cards_dealt':
      console.log(event.playerId, event.cards);
      break;
    case 'street_changed':
      console.log(event.street, event.communityCards);
      break;
    case 'hand_complete':
      console.log(event.result.winners, event.result.winningHand);
      break;
  }
});

engine.initGame(['player', 'ai1', 'ai2']);
engine.startNewHand();
```

The PixiJS app imports this same build through the `@engine` alias. Drawing cards and announcing a winner belong in that UI, not in the engine.

## Layout

```
engine/            @miko/engine — rules, AI, and tests
  src/             game engine, betting, pots, evaluator, deck, player
  src/ai/          PokerAI, pre-flop, post-flop, playstyle presets
  tests/
miko-ui/           @miko/ui — PixiJS app
  src/scenes/      StartScene, GameScene
  src/components/  table widgets (ActionBar, Card, PlayerSlot, and others)
  src/managers/    assets, audio, engine orchestration, settings
  src/tests/
  static/          cards, table art, sounds
public/            production output (gitignored)
nova/              changelogs and planning notes
build.sh           engine → UI → public/
```

## Requirements

- Node.js 20+
- npm 9+
- TypeScript 5+

## License

[MIT](LICENSE) © 2026 MiraNova Studio.
