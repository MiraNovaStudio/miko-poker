# MikoPoker UI: Cocos Creator to PixiJS Port Plan

## Verdict: Very Feasible — No Need to Start from Scratch

The engine is completely UI-agnostic (pure TypeScript, event-driven, no framework dependencies). The Cocos UI is essentially a rendering layer + game flow orchestrator. All game logic lives in the engine. This is a **port**, not a rewrite.

---

## What Can Be Reused Directly (No Modification)

- **Engine** (`engine/`) — 100% reusable as-is. Import from `engine/dist/index.js`
- **All image assets** — card PNGs (deck4), card backs, dealer button, table background, start screen
- **All audio assets** — check, bet, fold sounds, background music
- **Game flow logic** — The ~2000-line `GameTable.ts` is mostly framework-agnostic orchestration (event handling, turn management, AI delays). ~70% of the logic translates directly; only rendering calls change

## What Must Be Rewritten (Cocos to PixiJS)

| Cocos Concept | PixiJS Equivalent |
|---|---|
| `cc.Node` | `PIXI.Container` |
| `cc.Sprite` | `PIXI.Sprite` |
| `cc.Label` | `PIXI.Text` / `PIXI.BitmapText` |
| `cc.Button` | `PIXI.Sprite` with `eventMode = 'static'` + pointer events |
| `cc.AudioSource` | Web Audio API / Howler.js |
| `cc.resources.load()` | `PIXI.Assets.load()` |
| `cc.Scene` | App state machine (start screen vs game screen) |
| `cc.Prefab` (Card) | Card class extending `PIXI.Container` |
| `@property` decorators | Constructor parameters |
| `schedule()` / `scheduleOnce()` | `setTimeout` / `requestAnimationFrame` / Pixi ticker |

---

## Proposed Architecture: `miko-ui/`

```
miko-ui/
├── src/
│   ├── main.ts                  # Entry point, create PIXI.Application
│   ├── scenes/
│   │   ├── StartScene.ts        # Start screen with play button
│   │   └── GameScene.ts         # Main poker table scene
│   ├── components/
│   │   ├── Card.ts              # Card sprite (face-up/face-down, sizing)
│   │   ├── PlayerSlot.ts        # Player seat (name, chips, cards, bet, status)
│   │   ├── SlotLayout.ts        # 8-max layout positioning (rect/elliptical)
│   │   ├── ActionBar.ts         # Check/Call, Bet/Raise, Fold buttons + bet input
│   │   ├── CommunityCards.ts    # Flop/turn/river display
│   │   ├── PotDisplay.ts        # Pot label + side pots
│   │   ├── DealerButton.ts      # Dealer chip positioning
│   │   └── StatusBar.ts         # Game status + hand strength labels
│   ├── managers/
│   │   ├── GameManager.ts       # Port of GameTable.ts orchestration logic
│   │   ├── AudioManager.ts      # Web Audio / Howler.js wrapper
│   │   └── AssetManager.ts      # PIXI.Assets preloading
│   ├── utils/
│   │   └── constants.ts         # Layout coords, colors, sizes
│   └── types.ts                 # UI-specific types
├── public/
│   ├── assets/
│   │   ├── cards/               # Copy from MikoPokerUI/assets/resources/deck4/
│   │   ├── sounds/              # Copy from MikoPokerUI/assets/resources/sounds/
│   │   ├── table.png            # Table background
│   │   ├── dealer_button.png
│   │   ├── card_back.png
│   │   └── start_screen.png
│   └── index.html               # Single-page host
├── package.json
├── tsconfig.json
├── vite.config.ts               # Vite bundler
└── build.sh                     # Build & copy to ../public/
```

---

## Implementation Phases

### Phase 1: Project Scaffolding

- Initialize `miko-ui/` with Vite + TypeScript + PixiJS v8
- Copy assets from `MikoPokerUI/assets/resources/` into `miko-ui/public/assets/`
- Create `build.sh` to build and deploy output to top-level `public/`
- Verify engine imports work (`../../engine/dist/index.js`)
- Set up `index.html` with a full-viewport canvas

### Phase 2: Core Rendering

- `PIXI.Application` setup with responsive canvas sizing
- `Card` component — sprite loading, face-up/face-down toggle, sizing (80x112 hole cards, 100x140 community cards)
- `PlayerSlot` component — name label, chip overlay (dark background bar), card container, bet label, status indicator
- `SlotLayout` — port the 8 seat positions from `SlotLayoutManager.ts`
  - Seat 0 (Human, bottom-center): (0, -220)
  - Seat 1 (bottom-left): (-200, -220)
  - Seat 2 (left): (-440, 0)
  - Seat 3 (top-left): (-200, 220)
  - Seat 4 (top-center): (0, 220)
  - Seat 5 (top-right): (200, 220)
  - Seat 6 (right): (440, 0)
  - Seat 7 (bottom-right): (200, -220)
- Table background sprite + dealer button sprite

### Phase 3: Game Flow (Largest Phase)

- `GameManager` — port the orchestration logic from `GameTable.ts`:
  - Engine initialization (8 players, cash game, $5/$10 blinds, $1000 starting chips)
  - Event handler dispatch for all engine events:
    - `hand_started` — reset UI, prepare new hand
    - `blind_posted` — display blind amounts
    - `cards_dealt` — show hole cards for all players
    - `street_changed` — deal flop/turn/river community cards
    - `player_action` — update bet labels, fold indicators
    - `pot_updated` — refresh pot display
    - `hand_complete` — showdown, display winners, award chips
    - `game_over` — human player eliminated
  - Turn management loop (human wait vs AI auto-advance with 0.3-2s thinking delay)
  - Player state tracking and UI synchronization
- `ActionBar` — three-button system:
  - Left: Check/Call (dynamic label based on valid actions)
  - Middle: Bet/Raise (dynamic label based on betting phase)
  - Right: Fold
  - Bet input field (HTML overlay or PixiJS text input)
- `CommunityCards` — centered display for flop (3), turn (1), river (1)
- `PotDisplay` — main pot + side pots text
- `StatusBar` — current game state + human player hand strength

### Phase 4: Scenes and Polish

- Start screen with background image and play button
- Start screen to game screen transition (swap PIXI containers)
- Audio manager using Web Audio API or Howler.js:
  - `check_one_knock.wav` — check action
  - `bet_chips_2.wav` — bet/raise action
  - `fold.wav` — fold action
  - `Funky-Chiptune.ogg` — background music loop
- Player turn highlighting (green tint on active player slot)
- ALL-IN and ELIMINATED status indicators per slot
- New Game button shown when human player is eliminated
- Responsive scaling for different browser window sizes

### Phase 5: Build and Deploy

- `build.sh` script:
  1. Build engine (`cd engine && npm run build`)
  2. Build miko-ui with Vite (`cd miko-ui && npm run build`)
  3. Copy Vite output (`miko-ui/dist/`) to top-level `public/`
- Test in browser as a static site
- Ensure all assets load correctly from relative paths
- Verify no CORS or path issues when served statically

---

## Estimated Complexity

| Component | Lines (approx) | Difficulty |
|---|---|---|
| Project setup + config | ~100 | Low |
| Card component | ~80 | Low |
| PlayerSlot + SlotLayout | ~200 | Medium |
| GameManager (port from GameTable.ts) | ~600 | Medium-High |
| ActionBar + bet input | ~150 | Medium |
| CommunityCards + PotDisplay + StatusBar | ~100 | Low |
| AudioManager | ~80 | Low |
| Scenes + transitions | ~100 | Low |
| AssetManager + constants | ~80 | Low |
| **Total new code** | **~1,500** | |

The original `GameTable.ts` is 2,046 lines, but ~30% is Cocos-specific boilerplate that disappears with PixiJS's simpler API. The remaining game flow logic ports almost line-for-line.

---

## Key Decisions

1. **PixiJS v8** (latest) — modern, WebGPU-ready, tree-shakeable
2. **Vite** as bundler — fast dev server, clean production builds, excellent PixiJS support
3. **Howler.js** for audio (or raw Web Audio API to keep dependencies minimal)
4. **Single deck (deck4)** — the existing UI only uses deck4, no need to port all 4 decks
5. **No multiplayer/networking** — same as current implementation (local AI opponents only)
6. **HTML overlay for bet input** — simpler than building a text input in PixiJS canvas

---

## Engine Integration Reference

The engine is imported and used as follows (no changes needed):

```typescript
import { PokerGameEngine, evaluateHand, getHandName } from '../../engine/dist/index.js';
import type { GameEvent, Card as EngineCard, PlayerState } from '../../engine/dist/index.js';

const engine = new PokerGameEngine({
  gameType: 'cash',
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000,
  maxPlayers: 8,
});

engine.initGame(
  ['human', 'ai1', 'ai2', 'ai3', 'ai4', 'ai5', 'ai6', 'ai7'],
  new Map([
    ['ai1', 'easy'], ['ai2', 'normal'], ['ai3', 'hard'],
    ['ai4', 'easy'], ['ai5', 'normal'], ['ai6', 'hard'], ['ai7', 'pro'],
  ])
);

engine.on((event: GameEvent) => {
  // Dispatch to UI update methods
});

engine.startNewHand();
```

---

## Summary

This is a **straightforward port**, not a ground-up rebuild. The engine does not change. The assets do not change. The game flow logic is ~70% reusable. Only the rendering layer changes from Cocos Creator nodes/components to PixiJS containers/sprites/text. The bulk of the work is in `GameManager.ts`, porting the event handling and UI update logic from `GameTable.ts`.
