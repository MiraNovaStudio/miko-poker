# Cocos Creator Integration Guide

This guide shows how to integrate the MikoPoker engine with Cocos Creator UI.

## Setup

1. Build the engine:
```bash
cd engine
npm install
npm run build
```

2. The compiled engine will be in `engine/dist/`

## Import in Cocos Creator Scripts

```typescript
import { 
  PokerGameEngine,
  type GameState,
  type GameEvent,
  type Card
} from '../../engine/dist/index.js';
```

## Example: Main Game Controller

```typescript
import { _decorator, Component, Label, Button, Node } from 'cc';
import { PokerGameEngine, type GameEvent, type Card } from '../../engine/dist/index.js';

const { ccclass, property } = _decorator;

@ccclass('PokerGameController')
export class PokerGameController extends Component {
  @property(Label) potLabel: Label = null;
  @property(Label) statusLabel: Label = null;
  @property(Button) callButton: Button = null;
  @property(Button) raiseButton: Button = null;
  @property(Button) foldButton: Button = null;
  @property(Button) checkButton: Button = null;

  private engine: PokerGameEngine;
  private isPlayerTurn: boolean = false;

  start() {
    // Initialize engine
    this.engine = new PokerGameEngine({
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000
    });

    // Listen to game events
    this.engine.on((event) => this.handleGameEvent(event));

    // Setup button listeners
    this.callButton.node.on(Button.EventType.CLICK, this.onCallClick, this);
    this.raiseButton.node.on(Button.EventType.CLICK, this.onRaiseClick, this);
    this.foldButton.node.on(Button.EventType.CLICK, this.onFoldClick, this);
    this.checkButton.node.on(Button.EventType.CLICK, this.onCheckClick, this);

    // Start game
    this.engine.initGame(['player', 'ai']);
    this.startNewHand();
  }

  startNewHand() {
    this.engine.startNewHand();
    this.updateUI();
  }

  handleGameEvent(event: GameEvent) {
    switch (event.type) {
      case 'hand_started':
        this.statusLabel.string = 'New hand started';
        break;

      case 'cards_dealt':
        if (event.playerId === 'player') {
          this.displayPlayerCards(event.cards);
        }
        break;

      case 'street_changed':
        this.statusLabel.string = `${event.street.toUpperCase()}`;
        this.displayCommunityCards(event.communityCards);
        break;

      case 'player_action':
        this.statusLabel.string = `${event.playerId} ${event.action.type}`;
        break;

      case 'pot_updated':
        this.potLabel.string = `Pot: $${event.amount}`;
        break;

      case 'hand_complete':
        this.handleHandComplete(event.result);
        break;
    }

    this.updateUI();
  }

  updateUI() {
    const state = this.engine.getGameState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    this.isPlayerTurn = currentPlayer.id === 'player';

    // Update button states
    this.callButton.interactable = this.isPlayerTurn && state.canCall;
    this.raiseButton.interactable = this.isPlayerTurn && state.canRaise;
    this.foldButton.interactable = this.isPlayerTurn && state.canFold;
    this.checkButton.interactable = this.isPlayerTurn && state.canCheck;

    // Update button labels
    if (state.canCall) {
      const callLabel = this.callButton.node.getComponentInChildren(Label);
      if (callLabel) callLabel.string = `Call $${state.callAmount}`;
    }

    // If it's AI's turn, let AI act after a delay
    if (!this.isPlayerTurn && this.engine.isHandInProgress()) {
      this.scheduleOnce(() => {
        this.engine.processAIAction('ai');
      }, 1.5);
    }
  }

  onCallClick() {
    if (!this.isPlayerTurn) return;
    const state = this.engine.getGameState();
    this.engine.processAction('player', {
      type: 'call',
      amount: state.callAmount
    });
  }

  onRaiseClick() {
    if (!this.isPlayerTurn) return;
    const state = this.engine.getGameState();
    // Simple raise - raise to 2x current bet
    const raiseAmount = state.minRaiseAmount * 2;
    this.engine.processAction('player', {
      type: 'raise',
      amount: raiseAmount
    });
  }

  onFoldClick() {
    if (!this.isPlayerTurn) return;
    this.engine.processAction('player', { type: 'fold' });
  }

  onCheckClick() {
    if (!this.isPlayerTurn) return;
    this.engine.processAction('player', { type: 'check' });
  }

  displayPlayerCards(cards: Card[]) {
    // Implement card display logic
    // Load card sprites and position them
    console.log('Player cards:', cards);
  }

  displayCommunityCards(cards: Card[]) {
    // Implement community card display
    console.log('Community cards:', cards);
  }

  handleHandComplete(result: any) {
    const winnerText = result.winners.join(', ');
    this.statusLabel.string = `${winnerText} wins with ${result.winningHand}!`;
    
    // Schedule next hand
    this.scheduleOnce(() => {
      if (!this.engine.isHandInProgress()) {
        this.startNewHand();
      }
    }, 3);
  }
}
```

## Example: Card Display Component

```typescript
import { _decorator, Component, Sprite, Node, resources, SpriteFrame } from 'cc';
import type { Card } from '../../engine/dist/index.js';

const { ccclass, property } = _decorator;

@ccclass('CardDisplay')
export class CardDisplay extends Component {
  @property(Sprite) cardSprite: Sprite = null;

  displayCard(card: Card, faceUp: boolean = true) {
    if (!faceUp) {
      this.loadCardBack();
      return;
    }

    const cardPath = this.getCardPath(card);
    resources.load(cardPath, SpriteFrame, (err, spriteFrame) => {
      if (err) {
        console.error('Failed to load card:', err);
        return;
      }
      this.cardSprite.spriteFrame = spriteFrame;
    });
  }

  private loadCardBack() {
    resources.load('card_back/spriteFrame', SpriteFrame, (err, spriteFrame) => {
      if (err) {
        console.error('Failed to load card back:', err);
        return;
      }
      this.cardSprite.spriteFrame = spriteFrame;
    });
  }

  private getCardPath(card: Card): string {
    // Match your resource naming convention
    // Example: "cards/card_hearts_A/spriteFrame"
    const rankStr = card.rank === '10' ? '10' : 
                   ['A', 'K', 'Q', 'J'].includes(card.rank) ? card.rank : 
                   `0${card.rank}`;
    return `cards/card_${card.suit}_${rankStr}/spriteFrame`;
  }
}
```

## Example: Betting UI Component

```typescript
import { _decorator, Component, EditBox, Button, Label } from 'cc';
import type { PokerGameEngine } from '../../engine/dist/index.js';

const { ccclass, property } = _decorator;

@ccclass('BettingUI')
export class BettingUI extends Component {
  @property(EditBox) betInput: EditBox = null;
  @property(Button) betButton: Button = null;
  @property(Button) raiseButton: Button = null;
  @property(Label) minBetLabel: Label = null;

  private engine: PokerGameEngine = null;

  setEngine(engine: PokerGameEngine) {
    this.engine = engine;
    this.updateUI();
  }

  start() {
    this.betButton.node.on(Button.EventType.CLICK, this.onBetClick, this);
    this.raiseButton.node.on(Button.EventType.CLICK, this.onRaiseClick, this);
  }

  updateUI() {
    if (!this.engine) return;
    
    const state = this.engine.getGameState();
    this.minBetLabel.string = `Min: $${state.minBetAmount}`;
    
    this.betButton.interactable = state.canBet;
    this.raiseButton.interactable = state.canRaise;
  }

  onBetClick() {
    const amount = parseInt(this.betInput.string) || 0;
    const state = this.engine.getGameState();
    
    if (amount >= state.minBetAmount) {
      this.engine.processAction('player', {
        type: 'bet',
        amount: amount
      });
    }
  }

  onRaiseClick() {
    const amount = parseInt(this.betInput.string) || 0;
    const state = this.engine.getGameState();
    
    if (amount >= state.minRaiseAmount) {
      this.engine.processAction('player', {
        type: 'raise',
        amount: amount
      });
    }
  }
}
```

## Resource Naming Convention

For card images in Cocos Creator, use this naming pattern:

```
resources/
  cards/
    card_hearts_A.png
    card_hearts_K.png
    card_hearts_Q.png
    ...
    card_spades_02.png
    card_spades_03.png
    ...
  card_back.png
```

## Event Flow

1. **Game Initialization**
   - Create engine
   - Set up event listeners
   - Initialize players

2. **Hand Start**
   - Engine deals cards
   - Emits `hand_started` event
   - Emits `cards_dealt` for each player
   - UI displays player's cards

3. **Betting Rounds**
   - UI enables/disables buttons based on game state
   - Player clicks action button
   - Engine processes action
   - Emits `player_action` and `pot_updated` events
   - UI updates display
   - If AI's turn, call `processAIAction()`

4. **Street Changes**
   - Engine deals community cards
   - Emits `street_changed` event
   - UI displays new community cards

5. **Hand Complete**
   - Engine determines winner
   - Emits `hand_complete` event
   - UI shows result
   - Schedule next hand

## Best Practices

1. **Always check game state** before processing actions
2. **Subscribe to events** for reactive UI updates
3. **Use scheduleOnce** for AI delays to make it feel natural
4. **Handle errors gracefully** - engine may throw on invalid actions
5. **Update UI after every action** to keep it in sync
6. **Test with different scenarios** - all-ins, splits, etc.

## Common Patterns

### Getting Player's Cards
```typescript
const state = engine.getGameState();
const player = state.players.find(p => p.id === 'player');
const playerCards = player.cards; // Only shows player's own cards
```

### Checking Valid Actions
```typescript
const state = engine.getGameState();
if (state.canCheck) {
  // Show check button
}
if (state.canCall) {
  // Show call button with amount: state.callAmount
}
```

### Handling All-In
```typescript
onAllInClick() {
  const state = this.engine.getGameState();
  const player = state.players[state.currentPlayerIndex];
  this.engine.processAction('player', {
    type: 'allin',
    amount: player.chips
  });
}
```

## Debugging

Enable console logging of events:

```typescript
this.engine.on((event) => {
  console.log('Game Event:', JSON.stringify(event, null, 2));
});
```

## Next Steps

1. Implement card animations
2. Add sound effects
3. Create chip animations
4. Add player avatars
5. Implement multiplayer support
6. Add tournament mode

