# Debugging Setup Instructions

## 1. Make Card Prefab Inactive in Scene

If you have a Card node in your scene hierarchy (showing in the middle of the screen):
1. Select the Card node in the scene hierarchy
2. **UNCHECK the "Active" checkbox** in the Inspector (top right)
3. OR just delete it from the scene (the prefab file is what matters)

## 2. What the Debug Output Will Show

When you run the scene, you should see extensive console logging like this:

```
=== GameTable.start() ===
SlotLayoutManager: ✅ Assigned
Card Prefab: ✅ Assigned (or ❌ Missing)
...

✅ Created Slot 0 at position (0, -250)
✅ Created Slot 1 at position (280, -125)
...
📍 Total slots created: 8

=== 🎴 HAND STARTED ===
Players: 8, Dealer: 0
  ⚙️ Updating slot 0 for player
    Slot position: (0, -250)
    ✅ Slot 0 updated: player - $1000

=== 🎴 CARDS DEALT to player ===
  Cards: A♠, K♥
  Slot position: (0, -250)
  ✅ Created Cards container at (0, 20) relative to slot
  Cards will be FACE-UP
  Creating card 1: A♠ at x=-17.5
    🎴 createCard called: A♠, x=-17.5, faceUp=true
    ⚙️ Instantiating card from prefab...
    Card world position: (X, Y, Z)
      💳 Card.setCard called: A♠, faceUp: true
      ⚙️ Card.updateDisplay called
      Sprite: ✅, Data: ✅
      Loading card face...
      📂 Loading card face from: cards/ace_of_spades
      ✅ Card face loaded successfully: cards/ace_of_spades
      ✅ SpriteFrame assigned to sprite
```

## 3. What to Look For

### ✅ GOOD Signs:
- All components showing "✅ Assigned"
- Slots created at positions
- Cards being created and loaded
- "✅ Card face loaded successfully"
- "✅ SpriteFrame assigned"

### ❌ BAD Signs (Tell me which one you see):
- "❌ Missing" for any component
- "❌ Card prefab not assigned!"
- "❌ Failed to load card: cards/..."
- "❌ No slot node found"
- "❌ cardSprite is null"

## 4. Visual Debugging

You should NOW SEE on screen:
- **Yellow "Slot 0", "Slot 1"** etc. labels at each position
- **Player names** (player, ai1-ai7) below slots
- **Chip amounts** ($1000) below names
- **Cards** (either sprites or text labels as fallback)

If you don't see the slot labels, SlotLayoutManager isn't working!

## 5. Quick Fixes

**If no slots show:**
- Check that SlotLayoutManager is assigned to GameTable
- Check that SlotLayoutManager's maxPlayers = 8
- Check that SlotLayoutManager has a table node assigned

**If no cards show but slots work:**
- Check Card Prefab is assigned in GameTable
- Check Card Prefab has Card component attached
- Check Card component has cardSprite and debugLabel wired up

