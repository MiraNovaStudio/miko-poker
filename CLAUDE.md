# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**MikoPoker** — A Texas Hold'em poker game with a pure TypeScript engine and a PixiJS v8 browser UI. The project uses npm workspaces with two packages: `@miko/engine` (game logic) and `@miko/ui` (PixiJS rendering).

## Commands

```bash
npm install            # install all workspace dependencies
npm run dev            # Vite dev server on port 3000
npm run build          # full build: engine → UI → deploy to public/
npm run build:engine   # build engine only
npm run build:ui       # build UI only
npm run serve          # serve public/ on port 9001
npm test               # run engine unit tests
npm run lint           # lint engine code
```

## Architecture

- **Engine** (`engine/`) — Pure TypeScript, UI-agnostic. Event-driven via observer pattern. Exports: `PokerGameEngine`, `evaluateHand`, `getHandName`, types.
- **UI** (`miko-ui/`) — PixiJS v8 + Vite. Design resolution 960x720, aspect-ratio scaling. Scenes: StartScene, GameScene. The `@engine` alias resolves to `../engine/dist` via tsconfig paths and vite.config.ts.
- **Build** (`build.sh`) — Builds engine, validates `engine/dist/index.js`, builds UI, copies `miko-ui/dist/` to `public/`.
- **Static assets** are in `miko-ui/static/` (Vite `publicDir: 'static'`).

### Key Rule: Do NOT modify the engine

The engine is stable and tested. UI work should only import from `@engine` — never modify engine source files.

## Changelog Policy

### When to Write

Write a changelog entry for **every** completed task (feature, fix, refactor, or ad hoc work).

### Location

One file per change: `nova/changelog/YYYYMMDD/YYYYMMDD_HHMM_CHANGELOG.md`

Always run `date +"%Y%m%d.%H%M"` before writing to get the correct timestamp. If a timestamp conflicts, append `.1`, `.2`, etc.

### Format

Each changelog file should contain:

```markdown
# Title — YYYYMMDD.HHMM

## Summary
Brief description of what was done and why.

## Files Changed

### Modified
- **path/to/file** — what changed

### Added (if any)
- **path/to/new/file** — what it is

## Test results
- `npm test`: X suites, Y tests passed.

## Git Commit Hash
`TBD`

## Status
✅ Completed
```

### Versioning

- Patch (0.x.**Y**): bug fixes, layout tweaks
- Minor (0.**X**.0): new features, new components
- Major (**X**.0.0): breaking API changes

## Unit Test Policy

### Engine Tests

- Located in `engine/tests/`
- Run with `npm test` (from project root or engine directory)
- **100% pass rate required** before committing
- If 100% cannot be achieved after 3-5 attempts, pause and ask the user

### When to Run Tests

- After **every** code change to engine (bug fix, feature, or refactor)
- Before creating changelog entries and committing

### UI Tests

- No UI test suite currently exists
- Manual testing via `npm run dev` (Vite dev server on port 3000)

## Mandatory Post-Task Steps

For **every** completed task, before moving on:

1. **Changelog** — Write `nova/changelog/YYYYMMDD/YYYYMMDD_HHMM_CHANGELOG.md` (run `date +"%Y%m%d.%H%M"` first)
2. **Commit** — Stage all changed files + the changelog, then commit. One commit per task.

Never skip the changelog or commit. Do not batch multiple tasks into one commit.

## Git Conventions

- One commit per completed task
- Commit message: short description (< 80 chars)
- Run tests before committing
- Do not commit `node_modules/`, `engine/dist/`, `miko-ui/dist/`, or `public/`
