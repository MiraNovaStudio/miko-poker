/**
 * Card Component - Represents a single playing card
 * Can display either face-up (showing rank/suit) or face-down (card back)
 */

import { _decorator, Component, Sprite, SpriteFrame, Label, UITransform, Color, resources } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Card data from engine
 */
export interface CardData {
    rank: string;  // A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2
    suit: string;  // ♠, ♥, ♦, ♣
}

@ccclass('Card')
export class Card extends Component {
    @property(Sprite)
    cardSprite: Sprite | null = null;

    @property(Label)
    debugLabel: Label | null = null;

    @property
    cardWidth: number = 60;

    @property
    cardHeight: number = 84;

    private isFaceUp: boolean = false;
    private cardData: CardData | null = null;

    start() {
        // Initialize card size
        const transform = this.node.getComponent(UITransform);
        if (transform) {
            transform.setContentSize(this.cardWidth, this.cardHeight);
        }

        // Hide debug label by default
        if (this.debugLabel) {
            this.debugLabel.node.active = false;
        }
    }

    /**
     * Set the card data and display it
     * @param data Card rank and suit
     * @param faceUp Whether to show face-up or back
     */
    setCard(data: CardData, faceUp: boolean = true) {
        this.cardData = data;
        this.isFaceUp = faceUp;
        this.updateDisplay();
    }

    /**
     * Show card face
     */
    showFace() {
        this.isFaceUp = true;
        this.updateDisplay();
    }

    /**
     * Show card back
     */
    showBack() {
        this.isFaceUp = false;
        this.updateDisplay();
    }

    /**
     * Toggle between face and back
     */
    flip() {
        this.isFaceUp = !this.isFaceUp;
        this.updateDisplay();
    }

    /**
     * Update the visual display based on current state
     */
    private updateDisplay() {
        if (!this.cardSprite || !this.cardData) return;

        if (this.isFaceUp) {
            // Load and display card face
            this.loadCardFace();
        } else {
            // Load and display card back
            this.loadCardBack();
        }

        // Update debug label if enabled
        if (this.debugLabel) {
            this.debugLabel.string = `${this.cardData.rank}${this.cardData.suit}`;
        }
    }

    /**
     * Load card face sprite
     */
    private loadCardFace() {
        if (!this.cardData) return;

        const path = this.getCardResourcePath(this.cardData);
        
        resources.load(path, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error(`Failed to load card: ${path}`, err);
                this.showDebugLabel();
                return;
            }
            
            if (this.cardSprite) {
                this.cardSprite.spriteFrame = spriteFrame;
            }
        });
    }

    /**
     * Load card back sprite
     */
    private loadCardBack() {
        resources.load('card_back', SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error('Failed to load card back', err);
                this.showDebugLabel();
                return;
            }
            
            if (this.cardSprite) {
                this.cardSprite.spriteFrame = spriteFrame;
            }
        });
    }

    /**
     * Get resource path for a card
     */
    private getCardResourcePath(data: CardData): string {
        // Map engine card format to file names
        const rankMap: Record<string, string> = {
            'A': 'ace',
            'K': 'king',
            'Q': 'queen',
            'J': 'jack',
            '10': '10',
            '9': '9',
            '8': '8',
            '7': '7',
            '6': '6',
            '5': '5',
            '4': '4',
            '3': '3',
            '2': '2'
        };

        const suitMap: Record<string, string> = {
            '♠': 'spades',
            '♥': 'hearts',
            '♦': 'diamonds',
            '♣': 'clubs'
        };

        const rankName = rankMap[data.rank] || data.rank.toLowerCase();
        const suitName = suitMap[data.suit] || 'spades';

        return `cards/${rankName}_of_${suitName}`;
    }

    /**
     * Show debug label as fallback
     */
    private showDebugLabel() {
        if (this.debugLabel && this.cardData) {
            this.debugLabel.node.active = true;
            this.debugLabel.string = `${this.cardData.rank}${this.cardData.suit}`;
            this.debugLabel.color = new Color(255, 255, 255, 255);
            this.debugLabel.fontSize = 14;
        }
    }

    /**
     * Get card data
     */
    getCardData(): CardData | null {
        return this.cardData;
    }

    /**
     * Check if card is face up
     */
    isFaceUpCard(): boolean {
        return this.isFaceUp;
    }
}

