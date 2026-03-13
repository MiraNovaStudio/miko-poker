# UI 1.0.0 — PixiJS Port, Docs Update, Layout Fix — 20260312.1805

## Summary
Complete port of MikoPoker UI from Cocos Creator to PixiJS v8 with Vite bundler. Includes all game scenes, components, managers, responsive scaling, sound, and engine integration. Also updated README, created CLAUDE.md, wrote CHANGELOG.md entry, and fixed action bar being cut off at the bottom of the screen by increasing design resolution from 960x600 to 960x720.

## Reason
Cocos Creator is no longer available. The game needed a lightweight browser-based UI that renders via canvas and integrates with the existing pure TypeScript poker engine.

## Files Changed

### Added
- **miko-ui/** — Entire new PixiJS UI package
  - `src/main.ts` — App init, responsive aspect-ratio scaling (960x720), scene management
  - `src/types.ts` — Shared UI types
  - `src/scenes/StartScene.ts` — Splash screen with start button
  - `src/scenes/GameScene.ts` — Main game table, wires all components to engine
  - `src/components/ActionBar.ts` — Check/Call, Bet/Raise, Fold buttons + HTML bet input overlay
  - `src/components/Card.ts` — Sprite-based card with face/back/flip
  - `src/components/CommunityCards.ts` — 5-card board display
  - `src/components/DealerButton.ts` — Positional dealer chip
  - `src/components/PlayerSlot.ts` — Per-player container (cards, chips, name, bet, status)
  - `src/components/SlotLayout.ts` — 8-seat rectangular layout
  - `src/components/StatusBar.ts` — Pot and hand info display
  - `src/managers/AssetManager.ts` — Preloads all card textures and game assets
  - `src/managers/AudioManager.ts` — Web Audio API for sounds and music
  - `src/managers/GameManager.ts` — Full engine orchestration (~500 lines)
  - `src/utils/constants.ts` — Layout positions, colors, fonts, game config
  - `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`
- **build.sh** — Full build script at project root (engine → UI → deploy to public/)
- **CLAUDE.md** — Project guidance for Claude Code with changelog and test policies
- **nova/changelog/20260312/TIME_1805-CHANGELOG.md** — This file

### Modified
- **README.md** — Rewritten for PixiJS architecture, removed all Cocos Creator references
- **CHANGELOG.md** — Added UI 1.0.0 entry for the PixiJS port
- **package.json** — Root workspace config with workspaces, convenience scripts
- **.gitignore** — Added engine/dist/, miko-ui/dist/, public/

## Implementation details
- PixiJS v8 renders to a canvas element inside `#game-canvas`
- Engine imported via `@engine` alias (tsconfig paths + vite resolve.alias → `../engine/dist`)
- Responsive scaling: `Math.min(scaleX, scaleY)` against 960x720 design resolution
- Action bar at y=320 in design space sits below table edge (y=270) on the dark background
- HTML bet input positioned via screen-space transform from canvas coordinates
- Static assets served from `miko-ui/static/` (Vite `publicDir: 'static'`)

## Test results
- Engine tests: unchanged, all passing (engine was not modified)

## Git Commit Hash
`TBD`

## Status
Completed
