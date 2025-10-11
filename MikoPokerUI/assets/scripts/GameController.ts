/**
 * Main Game Controller for MikoPoker UI
 * Manages an 8-max cash game using the poker engine
 */

import { _decorator, Component, Label, Button, Node } from 'cc';
import { SlotLayoutManager } from './SlotLayoutManager';

// Import the poker engine
// Note: Adjust this path based on your tsconfig setup
// import { PokerGameEngine, type GameEvent, type GameState, type Card } from '../../../engine/dist/index.js';

const { ccclass, property } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    // === References to UI Components ===
    
    @property(SlotLayoutManager)
    slotLayoutManager: SlotLayoutManager | null = null;

    @property(Label)
    potLabel: Label | null = null;

    @property(Label)
    statusLabel: Label | null = null;

    @property(Node)
    communityCardsNode: Node | null = null;

    // === Action Buttons ===
    
    @property(Button)
    foldButton: Button | null = null;

    @property(Button)
    checkButton: Button | null = null;

    @property(Button)
    callButton: Button | null = null;

    @property(Button)
    betButton: Button | null = null;

    @property(Button)
    raiseButton: Button | null = null;

    @property(Button)
    allInButton: Button | null = null;

    @property(Button)
    dealButton: Button | null = null;

    // === Game Configuration ===
    
    @property
    maxPlayers: number = 8;

    @property
    smallBlind: number = 5;

    @property
    bigBlind: number = 10;

    @property
    startingChips: number = 1000;

    // === Private State ===
    
    // private engine: PokerGameEngine | null = null;
    private isPlayerTurn: boolean = false;
    private humanPlayerSeat: number = 0; // Seat 0 is always the human player

    start() {
        this.validateSetup();
        this.setupButtons();
        this.initializeEngine();
        this.updateStatusLabel('Click Deal to start');
    }

    /**
     * Validate that all required components are set up
     */
    private validateSetup() {
        if (!this.slotLayoutManager) {
            console.error('SlotLayoutManager not assigned to GameController!');
        }
        if (!this.potLabel) {
            console.warn('Pot label not assigned');
        }
        if (!this.statusLabel) {
            console.warn('Status label not assigned');
        }
    }

    /**
     * Initialize the poker engine
     */
    private initializeEngine() {
        // this.engine = new PokerGameEngine({
        //     gameType: 'cash',
        //     smallBlind: this.smallBlind,
        //     bigBlind: this.bigBlind,
        //     startingChips: this.startingChips,
        //     maxPlayers: this.maxPlayers
        // });

        // // Subscribe to game events
        // this.engine.on((event) => this.handleGameEvent(event));

        // // Create player IDs
        // const playerIds = this.createPlayerIds();
        // const aiDifficulties = this.createAIDifficulties(playerIds);

        // // Initialize game
        // this.engine.initGame(playerIds, aiDifficulties);

        console.log('Engine initialized (placeholder)');
    }

    /**
     * Create player IDs for 8-max game
     */
    private createPlayerIds(): string[] {
        const ids = ['player']; // Human player is always 'player'
        for (let i = 1; i < this.maxPlayers; i++) {
            ids.push(`ai${i}`);
        }
        return ids;
    }

    /**
     * Create AI difficulty map
     */
    private createAIDifficulties(playerIds: string[]): Map<string, 'easy' | 'normal' | 'hard' | 'pro'> {
        const difficulties = new Map<string, 'easy' | 'normal' | 'hard' | 'pro'>();
        const options: ('easy' | 'normal' | 'hard' | 'pro')[] = ['easy', 'normal', 'hard', 'pro'];
        
        playerIds.forEach((id, index) => {
            if (id !== 'player') {
                // Vary AI difficulty for more interesting gameplay
                difficulties.set(id, options[index % 4]);
            }
        });
        
        return difficulties;
    }

    /**
     * Setup button event listeners
     */
    private setupButtons() {
        if (this.foldButton) {
            this.foldButton.node.on(Button.EventType.CLICK, this.onFoldClick, this);
        }
        if (this.checkButton) {
            this.checkButton.node.on(Button.EventType.CLICK, this.onCheckClick, this);
        }
        if (this.callButton) {
            this.callButton.node.on(Button.EventType.CLICK, this.onCallClick, this);
        }
        if (this.betButton) {
            this.betButton.node.on(Button.EventType.CLICK, this.onBetClick, this);
        }
        if (this.raiseButton) {
            this.raiseButton.node.on(Button.EventType.CLICK, this.onRaiseClick, this);
        }
        if (this.allInButton) {
            this.allInButton.node.on(Button.EventType.CLICK, this.onAllInClick, this);
        }
        if (this.dealButton) {
            this.dealButton.node.on(Button.EventType.CLICK, this.onDealClick, this);
        }

        // Initially disable action buttons
        this.updateActionButtons(false, false, false, false, false, false);
    }

    // === Button Click Handlers ===

    private onDealClick() {
        // if (this.engine && !this.engine.isHandInProgress()) {
        //     this.engine.startNewHand();
        // }
        this.updateStatusLabel('New hand started (placeholder)');
    }

    private onFoldClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // this.engine.processAction('player', { type: 'fold' });
        this.updateStatusLabel('Player folded (placeholder)');
    }

    private onCheckClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // this.engine.processAction('player', { type: 'check' });
        this.updateStatusLabel('Player checked (placeholder)');
    }

    private onCallClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // const state = this.engine.getGameState();
        // this.engine.processAction('player', {
        //     type: 'call',
        //     amount: state.callAmount
        // });
        this.updateStatusLabel('Player called (placeholder)');
    }

    private onBetClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // const state = this.engine.getGameState();
        // this.engine.processAction('player', {
        //     type: 'bet',
        //     amount: state.minBetAmount
        // });
        this.updateStatusLabel('Player bet (placeholder)');
    }

    private onRaiseClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // const state = this.engine.getGameState();
        // this.engine.processAction('player', {
        //     type: 'raise',
        //     amount: state.minRaiseAmount
        // });
        this.updateStatusLabel('Player raised (placeholder)');
    }

    private onAllInClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // const state = this.engine.getGameState();
        // const playerState = state.players.find(p => p.id === 'player');
        // if (playerState) {
        //     this.engine.processAction('player', {
        //         type: 'allin',
        //         amount: playerState.chips
        //     });
        // }
        this.updateStatusLabel('Player all-in (placeholder)');
    }

    // === Game Event Handler ===

    // private handleGameEvent(event: GameEvent) {
    //     switch (event.type) {
    //         case 'hand_started':
    //             this.onHandStarted();
    //             break;

    //         case 'blind_posted':
    //             this.onBlindPosted(event.playerId, event.amount, event.isAnte);
    //             break;

    //         case 'cards_dealt':
    //             this.onCardsDealt(event.playerId, event.cards);
    //             break;

    //         case 'street_changed':
    //             this.onStreetChanged(event.street, event.communityCards);
    //             break;

    //         case 'player_action':
    //             this.onPlayerAction(event.playerId, event.action);
    //             break;

    //         case 'pot_updated':
    //             this.updatePotLabel(event.amount);
    //             break;

    //         case 'hand_complete':
    //             this.onHandComplete(event.result);
    //             break;

    //         case 'game_over':
    //             this.updateStatusLabel(`Game Over! Winner: ${event.winnerId}`);
    //             break;
    //     }

    //     // Update UI after each event
    //     this.updateUI();
    // }

    // === Event-Specific Handlers ===

    private onHandStarted() {
        this.updateStatusLabel('New hand started');
        this.clearCommunityCards();
    }

    private onBlindPosted(playerId: string, amount: number, isAnte?: boolean) {
        const type = isAnte ? 'ante' : 'blind';
        console.log(`${playerId} posted ${type}: $${amount}`);
        // Visual feedback can be added here (e.g., chip animation)
    }

    private onCardsDealt(playerId: string, cards: any[]) {
        if (playerId === 'player') {
            this.displayPlayerCards(cards);
        } else {
            this.displayOpponentCards(playerId);
        }
    }

    private onStreetChanged(street: string, communityCards: any[]) {
        this.updateStatusLabel(street.toUpperCase());
        this.displayCommunityCards(communityCards);
    }

    private onPlayerAction(playerId: string, action: any) {
        const actionText = `${playerId} ${action.type}${action.amount ? ` $${action.amount}` : ''}`;
        this.updateStatusLabel(actionText);
    }

    private onHandComplete(result: any) {
        const winners = result.winners.join(', ');
        this.updateStatusLabel(`${winners} wins $${result.potAmount}!`);
        
        // Auto-start next hand after delay
        this.scheduleOnce(() => {
            // if (this.engine && !this.engine.isHandInProgress()) {
            //     this.engine.startNewHand();
            // }
        }, 3);
    }

    // === UI Update Methods ===

    private updateUI() {
        // if (!this.engine) return;

        // const state = this.engine.getGameState();
        // const currentPlayer = state.players[state.currentPlayerIndex];
        // this.isPlayerTurn = currentPlayer.id === 'player';

        // // Update action buttons based on available actions
        // this.updateActionButtons(
        //     this.isPlayerTurn && state.canFold,
        //     this.isPlayerTurn && state.canCheck,
        //     this.isPlayerTurn && state.canCall,
        //     this.isPlayerTurn && state.canBet,
        //     this.isPlayerTurn && state.canRaise,
        //     this.isPlayerTurn // Can always all-in when it's your turn
        // );

        // // Update player info at each slot
        // this.updateAllPlayerSlots(state.players);

        // // Highlight current player
        // this.highlightCurrentPlayer(state.currentPlayerIndex);

        // // If it's AI's turn, schedule AI action
        // if (!this.isPlayerTurn && this.engine.isHandInProgress()) {
        //     this.scheduleOnce(() => {
        //         if (this.engine) {
        //             const aiAction = this.engine.getAIAction(currentPlayer.id);
        //             this.engine.processAction(currentPlayer.id, aiAction);
        //         }
        //     }, 1.5); // 1.5 second delay for AI thinking
        // }
    }

    /**
     * Update all player slot displays
     */
    private updateAllPlayerSlots(players: any[]) {
        if (!this.slotLayoutManager) return;

        players.forEach((player, index) => {
            const slot = this.slotLayoutManager!.getSlot(index);
            if (slot) {
                this.updatePlayerSlot(slot, player, index);
            }
        });
    }

    /**
     * Update a single player slot with current player state
     */
    private updatePlayerSlot(slotNode: Node, playerState: any, seatIndex: number) {
        // TODO: Update player name, chips, bet amount, etc.
        // This will be implemented when we add PlayerSlot component
        console.log(`Update slot ${seatIndex}:`, playerState);
    }

    /**
     * Highlight the current player's slot
     */
    private highlightCurrentPlayer(playerIndex: number) {
        if (!this.slotLayoutManager) return;

        // Remove highlight from all slots
        const allSlots = this.slotLayoutManager.getAllSlots();
        allSlots.forEach(slot => {
            // TODO: Remove highlight visual (e.g., glow effect)
        });

        // Add highlight to current player
        const currentSlot = this.slotLayoutManager.getSlot(playerIndex);
        if (currentSlot) {
            // TODO: Add highlight visual
        }
    }

    /**
     * Display player's hole cards
     */
    private displayPlayerCards(cards: any[]) {
        if (!this.slotLayoutManager) return;

        const playerSlot = this.slotLayoutManager.getSlot(this.humanPlayerSeat);
        if (playerSlot) {
            // TODO: Create card sprites and add to player slot
            console.log('Player cards:', cards);
        }
    }

    /**
     * Display opponent's card backs (face down)
     */
    private displayOpponentCards(playerId: string) {
        // TODO: Show card backs for opponents
        console.log(`${playerId} received cards`);
    }

    /**
     * Display community cards
     */
    private displayCommunityCards(cards: any[]) {
        if (!this.communityCardsNode) return;

        // TODO: Create card sprites for community cards
        console.log('Community cards:', cards);
    }

    /**
     * Clear community cards from display
     */
    private clearCommunityCards() {
        if (!this.communityCardsNode) return;

        // TODO: Remove all community card sprites
        this.communityCardsNode.removeAllChildren();
    }

    // === Label Update Methods ===

    private updateStatusLabel(text: string) {
        if (this.statusLabel) {
            this.statusLabel.string = text;
        }
    }

    private updatePotLabel(amount: number) {
        if (this.potLabel) {
            this.potLabel.string = `Pot: $${amount}`;
        }
    }

    private updateActionButtons(
        canFold: boolean,
        canCheck: boolean,
        canCall: boolean,
        canBet: boolean,
        canRaise: boolean,
        canAllIn: boolean
    ) {
        if (this.foldButton) this.foldButton.interactable = canFold;
        if (this.checkButton) this.checkButton.interactable = canCheck;
        if (this.callButton) this.callButton.interactable = canCall;
        if (this.betButton) this.betButton.interactable = canBet;
        if (this.raiseButton) this.raiseButton.interactable = canRaise;
        if (this.allInButton) this.allInButton.interactable = canAllIn;
    }

    /**
     * Get player ID from seat index
     */
    private getPlayerIdFromSeat(seatIndex: number): string {
        return seatIndex === 0 ? 'player' : `ai${seatIndex}`;
    }

    /**
     * Get seat index from player ID
     */
    private getSeatFromPlayerId(playerId: string): number {
        if (playerId === 'player') return 0;
        const match = playerId.match(/ai(\d+)/);
        return match ? parseInt(match[1]) : -1;
    }
}
