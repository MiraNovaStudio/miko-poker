# Poker Table Slot Positions

Visual reference for player slot positions in different table formats.

## 8-Max Layout

```
                    Seat 2 (BB if button=0)
                           ╔═╗
                           ║ ║
                           ╚═╝
                            
     Seat 3                                    Seat 1 (SB if button=0)
       ╔═╗                                          ╔═╗
       ║ ║                                          ║ ║
       ╚═╝                                          ╚═╝


Seat 4                 ┌─────────────┐                    Seat 0
  ╔═╗               ┌──┤             ├──┐                  ╔═╗
  ║ ║            ┌──┤  │   TABLE     │  ├──┐              ║?║ 
  ╚═╝            │  └──┤             ├──┘  │              ╚═╝
                 │      └─────────────┘      │            (PLAYER)
                 │                           │
                 └───────────────────────────┘

     Seat 5                                    Seat 7
       ╔═╗                                          ╔═╗
       ║ ║                                          ║ ║  
       ╚═╝                                          ╚═╝

                           ╔═╗
                           ║ ║
                           ╚═╝
                         Seat 6
```

**Positions (when Button is at Seat 0):**
- **Seat 0**: Button (Player) - acts last postflop
- **Seat 1**: Small Blind - acts first postflop
- **Seat 2**: Big Blind
- **Seat 3**: UTG (Under the Gun) - acts first preflop
- **Seat 4**: UTG+1
- **Seat 5**: Middle Position
- **Seat 6**: Middle Position  
- **Seat 7**: Cutoff - acts last preflop

---

## 6-Max Layout

```
                         Seat 2 (BB)
                            ╔═╗
                            ║ ║
                            ╚═╝
                            
       Seat 3                              Seat 1 (SB)
         ╔═╗                                  ╔═╗
         ║ ║      ┌─────────────┐            ║ ║
         ╚═╝   ┌──┤             ├──┐         ╚═╝
             ┌─┤  │   TABLE     │  ├─┐
             │ └──┤             ├──┘ │
             │    └─────────────┘    │     Seat 0
             │                       │       ╔═╗
             └───────────────────────┘       ║?║
                                             ╚═╝
       Seat 4                              (PLAYER)
         ╔═╗                                  ╔═╗
         ║ ║                                  ║ ║
         ╚═╝                                  ╚═╝
                                            Seat 5
```

**Positions (when Button is at Seat 0):**
- **Seat 0**: Button (Player)
- **Seat 1**: Small Blind
- **Seat 2**: Big Blind
- **Seat 3**: UTG
- **Seat 4**: Middle Position
- **Seat 5**: Cutoff

---

## 4-Max Layout

```
                         Seat 2 (BB)
                            ╔═╗
                            ║ ║
                            ╚═╝


     Seat 3                                    Seat 1 (SB)
       ╔═╗          ┌─────────────┐              ╔═╗
       ║ ║       ┌──┤             ├──┐           ║ ║
       ╚═╝       │  │   TABLE     │  │           ╚═╝
                 └──┤             ├──┘
                    └─────────────┘
                    
                          ╔═╗
                          ║?║
                          ╚═╝
                        Seat 0
                       (PLAYER)
```

**Positions (when Button is at Seat 0):**
- **Seat 0**: Button (Player)
- **Seat 1**: Small Blind
- **Seat 2**: Big Blind
- **Seat 3**: UTG (acts first preflop)

---

## 2-Max (Heads-Up) Layout

```
                         Seat 1 (BB)
                            ╔═╗
                            ║ ║
                            ╚═╝


                      ┌─────────────┐
                   ┌──┤             ├──┐
                   │  │   TABLE     │  │
                   └──┤             ├──┘
                      └─────────────┘
                    
                          ╔═╗
                          ║?║
                          ╚═╝
                        Seat 0
                  (PLAYER, Dealer/SB)
```

**Positions:**
- **Seat 0**: Player - Dealer + Small Blind (acts first preflop, last postflop)
- **Seat 1**: Opponent - Big Blind (acts last preflop, first postflop)

---

## Coordinate System

The `SlotLayoutManager` uses an **elliptical positioning system**:

```typescript
// Calculate position on ellipse
function getEllipsePosition(angle: number): Vec3 {
  const x = radiusX * Math.cos(angle);
  const y = radiusY * Math.sin(angle);
  return new Vec3(x, y, 0);
}
```

### Angles (in radians, starting from bottom)

**8-max:**
- Seat 0: 3π/2 (270°) - Bottom
- Seat 1: 3π/2 - π/4 = 5π/4 (225°) - Bottom-right
- Seat 2: π (180°) - Top
- Seat 3: π/2 + π/4 = 3π/4 (135°) - Top-left
- Seats 4-7: Continue clockwise

### Customization

Adjust the ellipse shape by modifying:

```typescript
@property radiusX: number = 400;  // Wider/narrower table
@property radiusY: number = 250;  // Taller/shorter table
```

**Examples:**
- Wide table: `radiusX = 500, radiusY = 200`
- Tall table: `radiusX = 300, radiusY = 300`  
- Circular table: `radiusX = 350, radiusY = 350`

---

## Action Order Reference

### Preflop (Before Flop)

**Heads-Up:**
1. Dealer/SB (Seat 0) acts first
2. BB (Seat 1) acts last

**Multiplayer (3+ players):**
1. UTG (seat after BB) acts first
2. Action proceeds clockwise
3. BB acts last

### Postflop (Flop, Turn, River)

**All formats:**
1. SB (or first active player after dealer) acts first
2. Action proceeds clockwise
3. Button acts last

---

## UI Layout Tips

### 1. Card Positions
Place hole cards slightly above/below the player slot:
```typescript
const cardOffset = new Vec3(0, 30, 0);  // 30px above slot
cardNode.setPosition(slotPosition.add(cardOffset));
```

### 2. Chip Stack Display
Show chips below the slot:
```typescript
const chipOffset = new Vec3(0, -40, 0);  // 40px below slot
chipLabel.setPosition(slotPosition.add(chipOffset));
```

### 3. Player Name
Show name at the slot:
```typescript
nameLabel.setPosition(slotPosition);
```

### 4. Dealer Button
Position at the dealer's slot:
```typescript
const dealerSlot = slotManager.getSlot(state.dealerIndex);
dealerButton.setPosition(dealerSlot.position);
```

### 5. Action Indicator
Show current player's turn:
```typescript
const currentSlot = slotManager.getSlot(state.currentPlayerIndex);
actionIndicator.setPosition(currentSlot.position);
// Add glow/highlight effect
```

---

## Example: Complete Slot Setup

```typescript
@ccclass('TableController')
export class TableController extends Component {
  @property(SlotLayoutManager)
  slotManager: SlotLayoutManager | null = null;
  
  @property(Prefab)
  playerSlotPrefab: Prefab | null = null;
  
  private playerSlots: Node[] = [];
  
  setupTable(playerCount: number) {
    // Create slots
    this.slotManager.updatePlayerCount(playerCount);
    const slots = this.slotManager.getAllSlots();
    
    // Create player UI at each slot
    slots.forEach((slot, index) => {
      const playerUI = instantiate(this.playerSlotPrefab);
      playerUI.setParent(this.node);
      playerUI.setPosition(slot.position);
      
      // Add components
      const nameLabel = playerUI.getChildByName('NameLabel');
      const chipsLabel = playerUI.getChildByName('ChipsLabel');
      const cardHolder = playerUI.getChildByName('CardHolder');
      
      this.playerSlots.push(playerUI);
    });
  }
  
  updatePlayers(state: GameState) {
    state.players.forEach((player, index) => {
      const slotUI = this.playerSlots[index];
      
      // Update name
      const name = slotUI.getChildByName('NameLabel').getComponent(Label);
      name.string = player.id;
      
      // Update chips
      const chips = slotUI.getChildByName('ChipsLabel').getComponent(Label);
      chips.string = `$${player.chips}`;
      
      // Show dealer button
      if (player.isDealer) {
        this.showDealerAt(index);
      }
      
      // Highlight current player
      if (index === state.currentPlayerIndex) {
        this.highlightSlot(index);
      }
    });
  }
}
```

---

## Summary

- ✅ Automatic slot positioning for 2/4/6/8 players
- ✅ Elliptical layout around table
- ✅ Configurable radius and player count
- ✅ Player always at bottom (Seat 0)
- ✅ Easy to customize and extend

Use the `SlotLayoutManager` component to handle all positioning automatically!

