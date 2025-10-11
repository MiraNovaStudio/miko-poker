/**
 * Main Game Controller for MikoPoker UI
 * This script integrates the poker engine with Cocos Creator
 */

import { _decorator, Component, Label, Button, Node } from 'cc';

// Import the poker engine
// Note: You may need to adjust this path based on your tsconfig setup
// import { PokerGameEngine, type GameEvent, type GameState } from '../../../engine/dist/index.js';

const { ccclass, property } = _decorator;

/**
 * For now, this is a template showing how to integrate with the engine.
 * Uncomment the import above once the project is properly configured.
 */
@ccclass('GameController')
export class GameController extends Component {
    @property(Label)
    potLabel: Label | null = null;

    @property(Label)
    playerChipsLabel: Label | null = null;

    @property(Label)
    opponentChipsLabel: Label | null = null;

    @property(Label)
    statusLabel: Label | null = null;

    @property(Button)
    callButton: Button | null = null;

    @property(Button)
    raiseButton: Button | null = null;

    @property(Button)
    foldButton: Button | null = null;

    @property(Button)
    checkButton: Button | null = null;

    @property(Button)
    dealButton: Button | null = null;

    @property(Node)
    playerCardSlot1: Node | null = null;

    @property(Node)
    playerCardSlot2: Node | null = null;

    @property(Node)
    opponentCardSlot1: Node | null = null;

    @property(Node)
    opponentCardSlot2: Node | null = null;

    @property(Node)
    communitySlot1: Node | null = null;

    @property(Node)
    communitySlot2: Node | null = null;

    @property(Node)
    communitySlot3: Node | null = null;

    @property(Node)
    communitySlot4: Node | null = null;

    @property(Node)
    communitySlot5: Node | null = null;

    // private engine: PokerGameEngine | null = null;
    private isPlayerTurn: boolean = false;

    start() {
        // Initialize the game engine
        // this.engine = new PokerGameEngine({
        //     smallBlind: 5,
        //     bigBlind: 10,
        //     startingChips: 1000
        // });

        // // Subscribe to game events
        // this.engine.on((event) => this.handleGameEvent(event));

        // Setup button listeners
        this.setupButtons();

        // Initialize game
        // this.engine.initGame(['player', 'ai']);
        
        this.updateStatusLabel('Click Deal to start');
    }

    private setupButtons() {
        if (this.callButton) {
            this.callButton.node.on(Button.EventType.CLICK, this.onCallClick, this);
        }
        if (this.raiseButton) {
            this.raiseButton.node.on(Button.EventType.CLICK, this.onRaiseClick, this);
        }
        if (this.foldButton) {
            this.foldButton.node.on(Button.EventType.CLICK, this.onFoldClick, this);
        }
        if (this.checkButton) {
            this.checkButton.node.on(Button.EventType.CLICK, this.onCheckClick, this);
        }
        if (this.dealButton) {
            this.dealButton.node.on(Button.EventType.CLICK, this.onDealClick, this);
        }

        this.updateButtonStates(false, false, false, false);
    }

    private onDealClick() {
        // if (this.engine && !this.engine.isHandInProgress()) {
        //     this.engine.startNewHand();
        // }
        this.updateStatusLabel('New hand started');
    }

    private onCallClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // const state = this.engine.getGameState();
        // this.engine.processAction('player', {
        //     type: 'call',
        //     amount: state.callAmount
        // });
        this.updateStatusLabel('Player called');
    }

    private onRaiseClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // const state = this.engine.getGameState();
        // this.engine.processAction('player', {
        //     type: 'raise',
        //     amount: state.minRaiseAmount
        // });
        this.updateStatusLabel('Player raised');
    }

    private onFoldClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // this.engine.processAction('player', { type: 'fold' });
        this.updateStatusLabel('Player folded');
    }

    private onCheckClick() {
        // if (!this.isPlayerTurn || !this.engine) return;
        // this.engine.processAction('player', { type: 'check' });
        this.updateStatusLabel('Player checked');
    }

    // private handleGameEvent(event: GameEvent) {
    //     switch (event.type) {
    //         case 'hand_started':
    //             this.updateStatusLabel('New hand started');
    //             break;

    //         case 'cards_dealt':
    //             if (event.playerId === 'player') {
    //                 this.displayPlayerCards(event.cards);
    //             }
    //             break;

    //         case 'street_changed':
    //             this.updateStatusLabel(event.street.toUpperCase());
    //             this.displayCommunityCards(event.communityCards);
    //             break;

    //         case 'player_action':
    //             this.updateStatusLabel(`${event.playerId} ${event.action.type}`);
    //             break;

    //         case 'pot_updated':
    //             this.updatePotLabel(event.amount);
    //             break;

    //         case 'hand_complete':
    //             this.handleHandComplete(event.result);
    //             break;

    //         case 'game_over':
    //             this.updateStatusLabel(`Game Over! Winner: ${event.winnerId}`);
    //             break;
    //     }

    //     this.updateUI();
    // }

    private updateUI() {
        // if (!this.engine) return;
        
        // const state = this.engine.getGameState();
        // const currentPlayer = state.players[state.currentPlayerIndex];
        // this.isPlayerTurn = currentPlayer.id === 'player';

        // // Update button states
        // this.updateButtonStates(
        //     this.isPlayerTurn && state.canCall,
        //     this.isPlayerTurn && state.canRaise,
        //     this.isPlayerTurn && state.canFold,
        //     this.isPlayerTurn && state.canCheck
        // );

        // // Update labels
        // this.updatePlayerChips(state.players[0].chips);
        // this.updateOpponentChips(state.players[1].chips);

        // // If it's AI's turn, schedule AI action
        // if (!this.isPlayerTurn && this.engine.isHandInProgress()) {
        //     this.scheduleOnce(() => {
        //         if (this.engine) {
        //             this.engine.processAIAction('ai');
        //         }
        //     }, 1.5);
        // }
    }

    private updateButtonStates(canCall: boolean, canRaise: boolean, canFold: boolean, canCheck: boolean) {
        if (this.callButton) this.callButton.interactable = canCall;
        if (this.raiseButton) this.raiseButton.interactable = canRaise;
        if (this.foldButton) this.foldButton.interactable = canFold;
        if (this.checkButton) this.checkButton.interactable = canCheck;
    }

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

    private updatePlayerChips(amount: number) {
        if (this.playerChipsLabel) {
            this.playerChipsLabel.string = `You: $${amount}`;
        }
    }

    private updateOpponentChips(amount: number) {
        if (this.opponentChipsLabel) {
            this.opponentChipsLabel.string = `Opponent: $${amount}`;
        }
    }

    // private displayPlayerCards(cards: any[]) {
    //     // TODO: Implement card display logic
    //     console.log('Player cards:', cards);
    // }

    // private displayCommunityCards(cards: any[]) {
    //     // TODO: Implement community cards display
    //     console.log('Community cards:', cards);
    // }

    // private handleHandComplete(result: any) {
    //     const winnerText = result.winners.join(', ');
    //     this.updateStatusLabel(`${winnerText} wins!`);
        
    //     this.scheduleOnce(() => {
    //         if (this.engine && !this.engine.isHandInProgress()) {
    //             this.engine.startNewHand();
    //         }
    //     }, 3);
    // }
}

