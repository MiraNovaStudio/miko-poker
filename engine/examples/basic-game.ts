/**
 * Example: Basic poker game usage
 * This demonstrates how to use the engine from a UI
 */

import { PokerGameEngine } from '../src/index';
import type { GameEvent } from '../src/index';

// Create game engine with custom config
const engine = new PokerGameEngine({
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000
});

// Listen to game events
engine.on((event: GameEvent) => {
  switch (event.type) {
    case 'hand_started':
      console.log('New hand started!');
      break;
    
    case 'cards_dealt':
      console.log(`Cards dealt to ${event.playerId}:`, event.cards);
      break;
    
    case 'street_changed':
      console.log(`Street changed to ${event.street}`);
      console.log('Community cards:', event.communityCards);
      break;
    
    case 'player_action':
      console.log(`${event.playerId} ${event.action.type}`);
      break;
    
    case 'pot_updated':
      console.log(`Pot: ${event.amount}`);
      break;
    
    case 'hand_complete':
      console.log('Hand complete!');
      console.log('Winners:', event.result.winners);
      console.log('Winning hand:', event.result.winningHand);
      break;
    
    case 'game_over':
      console.log(`Game over! Winner: ${event.winnerId}`);
      break;
  }
});

// Initialize game with 2 players
engine.initGame(['player', 'ai']);

// Start a new hand
engine.startNewHand();

// Get current game state
let state = engine.getGameState();
console.log('Current street:', state.street);
console.log('Community cards:', state.communityCards);
console.log('Pot:', state.pot);

// Player 1's turn
const currentPlayer = state.players[state.currentPlayerIndex];
console.log(`${currentPlayer.id}'s turn`);
console.log('Available actions:', {
  canCheck: state.canCheck,
  canBet: state.canBet,
  canCall: state.canCall,
  canRaise: state.canRaise,
  canFold: state.canFold
});

// Process player action
if (currentPlayer.id === 'player') {
  // Human player - process their action
  if (state.canCall) {
    engine.processAction(currentPlayer.id, { 
      type: 'call', 
      amount: state.callAmount 
    });
  } else {
    engine.processAction(currentPlayer.id, { type: 'check' });
  }
}

// AI's turn
state = engine.getGameState();
const aiPlayer = state.players[state.currentPlayerIndex];
if (aiPlayer.id === 'ai') {
  // AI player - get AI decision
  const aiAction = engine.processAIAction(aiPlayer.id);
  console.log('AI action:', aiAction);
}

// Continue playing...
// In a real UI, you would:
// 1. Listen to events to update UI
// 2. Get game state to render current situation
// 3. Process actions from UI buttons/inputs
// 4. Call processAIAction for computer opponents

// Example: Complete automation of a hand
function playHandAutomatically() {
  engine.startNewHand();
  
  while (engine.isHandInProgress()) {
    const state = engine.getGameState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    
    if (currentPlayer.id === 'player') {
      // Simulate player actions (in real game, this comes from UI)
      if (state.canCheck) {
        engine.processAction(currentPlayer.id, { type: 'check' });
      } else if (state.canCall) {
        engine.processAction(currentPlayer.id, { 
          type: 'call', 
          amount: state.callAmount 
        });
      } else {
        engine.processAction(currentPlayer.id, { type: 'fold' });
      }
    } else {
      // AI player
      engine.processAIAction(currentPlayer.id);
    }
  }
}

// Play a few hands
for (let i = 0; i < 3; i++) {
  console.log(`\n=== Hand ${i + 1} ===`);
  playHandAutomatically();
}

// Get final chip counts
const finalState = engine.getPlayers();
console.log('\nFinal chip counts:');
for (const player of finalState) {
  console.log(`${player.id}: ${player.chips} chips`);
}

export { engine };

