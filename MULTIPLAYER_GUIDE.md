# MikoPoker Multiplayer Guide

## Overview

The MikoPoker engine now **fully supports multiplayer games** from 2 to 8 players!

## Supported Formats

- ✅ **2-max (Heads-Up)** - Classic one-on-one poker
- ✅ **4-max** - Fast-paced 4-player tables
- ✅ **6-max** - Popular 6-player format
- ✅ **8-max** - Full ring poker

## Engine Features

### ✅ Complete Multiplayer Support

1. **Proper Blind Posting**
   - Heads-up: Dealer = SB, Other = BB
   - Multiplayer: SB is left of dealer, BB is left of SB

2. **Correct Action Order**
   - Preflop: UTG (after BB) acts first in multiplayer
   - Postflop: SB (or first active after dealer) acts first

3. **Dealer Button Rotation**
   - Button moves clockwise after each hand
   - Blinds follow the button

4. **Chip Stack Management**
   - Each player has independent chip stack
   - Stacks persist across hands
   - Game ends when only one player has chips

## Engine Usage

### Initialize Multiplayer Game

```typescript
import { PokerGameEngine } from '../../engine/dist/index.js';

// 8-max game
const engine = new PokerGameEngine({
  maxPlayers: 8,
  smallBlind: 10,
  bigBlind: 20,
  startingChips: 2000
});

// Initialize with player IDs
engine.initGame([
  'player',    // Seat 0 (human player)
  'ai1',       // Seat 1
  'ai2',       // Seat 2
  'ai3',       // Seat 3
  'ai4',       // Seat 4
  'ai5',       // Seat 5
  'ai6',       // Seat 6
  'ai7'        // Seat 7
]);

// Start playing
engine.startNewHand();
```

### Player Positions

**Heads-Up (2 players):**
- Seat 0: Dealer/Small Blind (acts first preflop)
- Seat 1: Big Blind

**4-max:**
- Seat 0: Button (when button = 0)
- Seat 1: Small Blind
- Seat 2: Big Blind  
- Seat 3: UTG (acts first preflop)

**6-max:**
- Seat 0: Button (when button = 0)
- Seat 1: Small Blind
- Seat 2: Big Blind
- Seat 3: UTG
- Seat 4: Middle Position
- Seat 5: Cutoff

**8-max:**
- Seat 0: Button (when button = 0)
- Seat 1: Small Blind
- Seat 2: Big Blind
- Seat 3: UTG
- Seat 4: UTG+1
- Seat 5: Middle Position
- Seat 6: Middle Position
- Seat 7: Cutoff

## Slot Layout System

### SlotLayoutManager Component

A Cocos Creator component that automatically positions player slots around the table.

#### Features

- **Automatic Positioning** - Calculates elliptical positions
- **Configurable** - Adjust radius, player count
- **Flexible** - Supports 2/4/6/8 player layouts
- **Responsive** - Adapts to table size

#### Usage in Cocos Creator

1. **Add to Scene:**
   - Create a Node (e.g., "SlotManager")
   - Add `SlotLayoutManager` component

2. **Configure:**
   ```typescript
   @property(Node) tableNode: Node | null = null;  // Reference to table
   @property maxPlayers: number = 8;                // 2, 4, 6, or 8
   @property radiusX: number = 400;                 // Horizontal radius
   @property radiusY: number = 250;                 // Vertical radius
   ```

3. **Access Slots:**
   ```typescript
   // Get slot by index
   const slot = slotManager.getSlot(0);  // Player's slot
   
   // Get all slots
   const allSlots = slotManager.getAllSlots();
   
   // Get slot configuration
   const config = slotManager.getSlotConfig(2);
   // config = { position: Vec3, rotation: number, seatIndex: number }
   ```

### Slot Positions

#### 8-max Layout (Elliptical)

```
             Top
          (Seat 2)
     
   (Seat 3)     (Seat 1)

(Seat 4)           (Seat 0/Button)

   (Seat 5)     (Seat 7)
     
          (Seat 6)
           Bottom
         (Player)
```

Player (you) is always at the bottom (Seat 0 when button is there).

#### Dynamic Layout

The layout automatically adjusts based on `maxPlayers`:

- **2-max**: Top and bottom only
- **4-max**: Top, bottom, left, right
- **6-max**: Evenly distributed around ellipse
- **8-max**: Evenly distributed around ellipse

### Integration Example

```typescript
import { SlotLayoutManager } from './SlotLayoutManager';
import { PokerGameEngine } from '../../../engine/dist/index.js';

@ccclass('GameController')
export class GameController extends Component {
  @property(SlotLayoutManager)
  slotManager: SlotLayoutManager | null = null;
  
  private engine: PokerGameEngine;
  
  start() {
    // Create engine for 8-max
    this.engine = new PokerGameEngine({
      maxPlayers: 8,
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 2000
    });
    
    // Initialize players
    const playerIds = ['player', 'ai1', 'ai2', 'ai3', 'ai4', 'ai5', 'ai6', 'ai7'];
    this.engine.initGame(playerIds);
    
    // Start hand
    this.engine.startNewHand();
    
    // Get game state
    const state = this.engine.getGameState();
    
    // Display players in slots
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      const slot = this.slotManager.getSlot(i);
      
      // Position player UI at slot
      this.displayPlayer(player, slot);
    }
  }
  
  displayPlayer(player: any, slot: Node) {
    // Add player name, chips, cards at slot position
    // ...
  }
}
```

## Chip Stack Management

### How It Works

1. **Initialization:**
   ```typescript
   engine.initGame(['p1', 'p2', 'p3']);
   // Each player starts with config.startingChips
   ```

2. **During Hand:**
   - Players bet/fold/call/raise
   - Chips move from player stack to pot
   - Player stacks decrease with each bet

3. **End of Hand:**
   - Winner(s) determined
   - Pot awarded to winner(s)
   - Chip stacks updated

4. **Next Hand:**
   - Chip stacks persist
   - New blinds posted
   - Hand continues until one player has all chips

### Accessing Chip Stacks

```typescript
const state = engine.getGameState();

// Get specific player
const player = state.players[0];
console.log(`${player.id} has ${player.chips} chips`);

// Get all chip stacks
state.players.forEach(p => {
  console.log(`${p.id}: ${p.chips} chips`);
});
```

### Game Over Condition

```typescript
engine.on((event) => {
  if (event.type === 'game_over') {
    console.log(`Winner: ${event.winnerId}`);
    // Only one player has chips remaining
  }
});
```

## Testing

All multiplayer features are fully tested:

```bash
cd engine
npm test
```

**Test Results:**
```
✓ Multiplayer Support (6 tests)
  ✓ should initialize 4-player game
  ✓ should initialize 6-player game  
  ✓ should initialize 8-player game
  ✓ should post blinds correctly in 4-player game
  ✓ should maintain chip stacks across hands
  ✓ should rotate dealer button

Total: 27/27 tests passing ✅
```

## Best Practices

### 1. Use Correct Player Count

```typescript
// Good ✅
const engine = new PokerGameEngine({ maxPlayers: 6 });
engine.initGame(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);

// Bad ❌ - Will throw error
const engine = new PokerGameEngine({ maxPlayers: 2 });
engine.initGame(['p1', 'p2', 'p3', 'p4']);  // Error: Max 2 players!
```

### 2. Track Current Player

```typescript
const state = engine.getGameState();
const currentPlayer = state.players[state.currentPlayerIndex];

if (currentPlayer.id === 'player') {
  // Human player's turn - enable action buttons
  this.enablePlayerControls(true);
} else {
  // AI turn - process AI action
  this.scheduleOnce(() => {
    engine.processAIAction(currentPlayer.id);
  }, 1.5);
}
```

### 3. Display All Players

```typescript
engine.on((event) => {
  if (event.type === 'hand_started') {
    const state = engine.getGameState();
    
    // Update all player displays
    state.players.forEach((player, index) => {
      const slot = this.slotManager.getSlot(index);
      this.updatePlayerDisplay(player, slot);
      
      // Show dealer button on correct player
      if (player.isDealer) {
        this.showDealerButton(slot);
      }
    });
  }
});
```

### 4. Handle Dealer Button

```typescript
// Dealer button rotates automatically
const state = engine.getGameState();
const dealerPlayer = state.players[state.dealerIndex];

console.log(`Dealer: ${dealerPlayer.id} at seat ${state.dealerIndex}`);

// Position dealer button sprite at dealer's slot
const dealerSlot = this.slotManager.getSlot(state.dealerIndex);
this.dealerButton.setPosition(dealerSlot.position);
```

## API Reference

### PokerGameEngine

```typescript
// Config
interface GameConfig {
  maxPlayers: number;      // 2, 4, 6, or 8
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
}

// Initialize
engine.initGame(playerIds: string[]);  // playerIds.length <= maxPlayers

// State
engine.getGameState();  // Returns GameState with all players
engine.getPlayers();    // Returns PlayerState[]
```

### SlotLayoutManager

```typescript
// Configuration
@property maxPlayers: number;    // 2, 4, 6, or 8
@property radiusX: number;       // Horizontal radius
@property radiusY: number;       // Vertical radius

// Methods
getSlot(seatIndex: number): Node | null;
getAllSlots(): Node[];
getSlotConfig(seatIndex: number): SlotConfig | null;
updatePlayerCount(newCount: number): void;
```

### SlotConfig

```typescript
interface SlotConfig {
  position: Vec3;      // Position on table
  rotation: number;    // Rotation angle (for future use)
  seatIndex: number;   // Seat number (0-7)
}
```

## Common Scenarios

### Starting an 8-max Game

```typescript
const engine = new PokerGameEngine({
  maxPlayers: 8,
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000
});

engine.initGame([
  'player',
  'ai1', 'ai2', 'ai3', 'ai4', 'ai5', 'ai6', 'ai7'
]);

engine.on((event) => {
  console.log('Event:', event.type);
});

engine.startNewHand();
```

### Changing Table Size

```typescript
// Start with 6-max
slotManager.maxPlayers = 6;
slotManager.createSlots();

// Later switch to 8-max
slotManager.updatePlayerCount(8);
```

### Tracking Elimination

```typescript
engine.on((event) => {
  if (event.type === 'hand_complete') {
    const state = engine.getGameState();
    
    // Check for players with 0 chips
    state.players.forEach(player => {
      if (player.chips === 0) {
        console.log(`${player.id} eliminated!`);
        this.showEliminationMessage(player.id);
      }
    });
  }
});
```

## Summary

✅ **Engine fully supports 2/4/6/8 player games**  
✅ **Proper blinds, action order, and button rotation**  
✅ **Chip stacks maintained across hands**  
✅ **SlotLayoutManager for automatic positioning**  
✅ **All features tested and working**

Ready for your UI implementation! 🎮♠️♥️♦️♣️

