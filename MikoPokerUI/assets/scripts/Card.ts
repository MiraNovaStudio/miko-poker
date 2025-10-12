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
    suit: string;  // spades, hearts, diamonds, clubs
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

    onLoad() {
        // Ensure sprite reference is set (find it if not assigned in editor)
        if (!this.cardSprite) {
            this.cardSprite = this.node.getComponent(Sprite);
            if (!this.cardSprite) {
                console.error('❌ No Sprite component found on Card prefab!');
            }
        }
    }

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
        console.log(`      💳 Card.setCard called: ${data.rank}${data.suit}, faceUp: ${faceUp}`);

        // Ensure sprite reference exists (in case onLoad hasn't run yet)
        if (!this.cardSprite) {
            this.cardSprite = this.node.getComponent(Sprite);
            if (!this.cardSprite) {
                console.error('      ❌ CRITICAL: No Sprite component on card node!');
                return;
            }
        }

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
        console.log(`      ⚙️ Card.updateDisplay called`);

        if (!this.cardSprite) {
            console.error('      ❌ cardSprite is null!');
            return;
        }

        if (!this.cardData) {
            console.error('      ❌ cardData is null!');
            return;
        }

        console.log(`      Sprite: ${this.cardSprite ? '✅' : '❌'}, Data: ${this.cardData ? '✅' : '❌'}`);

        if (this.isFaceUp) {
            // Load and display card face
            console.log('      Loading card face...');
            this.loadCardFace();
        } else {
            // Load and display card back
            console.log('      Loading card back...');
            this.loadCardBack();
        }

        // Keep debug label hidden (we don't want to reveal card info)
        if (this.debugLabel) {
            this.debugLabel.node.active = false;
        }
    }

    /**
     * Load card face sprite
     */
    private loadCardFace() {
        if (!this.cardData) return;

        const path = this.getCardResourcePath(this.cardData) + '/spriteFrame';
        console.log(`      📂 Loading card face from: ${path}`);

        resources.load(path, SpriteFrame, (err, spriteFrame) => {
            // Check if component still exists (not destroyed)
            if (!this.node || !this.node.isValid) {
                return; // Silently return if node was destroyed
            }

            if (err) {
                console.error(`      ❌ Failed to load card: ${path}`, err);
                this.showDebugLabel();
                return;
            }

            console.log(`      ✅ Card face loaded successfully: ${path}`);

            if (this.cardSprite && this.cardSprite.isValid) {
                this.cardSprite.spriteFrame = spriteFrame;

                // Set sprite to CUSTOM size mode and force it to 60x84
                this.cardSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                const spriteTransform = this.cardSprite.node.getComponent(UITransform);
                if (spriteTransform) {
                    spriteTransform.setContentSize(this.cardWidth, this.cardHeight);
                    console.log(`      ✅ Sprite sized to ${this.cardWidth}x${this.cardHeight}`);
                }
            }
        });
    }

    /**
     * Load card back sprite
     */
    private loadCardBack() {
        console.log('      📂 Loading card back from: card_back/spriteFrame');

        resources.load('card_back/spriteFrame', SpriteFrame, (err, spriteFrame) => {
            // Check if component still exists (not destroyed)
            if (!this.node || !this.node.isValid) {
                return; // Silently return if node was destroyed
            }

            if (err) {
                console.error('      ❌ Failed to load card back', err);
                this.showDebugLabel();
                return;
            }

            console.log('      ✅ Card back loaded successfully');

            if (this.cardSprite && this.cardSprite.isValid) {
                this.cardSprite.spriteFrame = spriteFrame;

                // Set sprite to CUSTOM size mode and force it to 60x84
                this.cardSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                const spriteTransform = this.cardSprite.node.getComponent(UITransform);
                if (spriteTransform) {
                    spriteTransform.setContentSize(this.cardWidth, this.cardHeight);
                    console.log(`      ✅ Card back sprite sized to ${this.cardWidth}x${this.cardHeight}`);
                }
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

        // Engine sends suits as strings: 'spades', 'hearts', 'diamonds', 'clubs'
        const suitMap: Record<string, string> = {
            'spades': 'spades',
            'hearts': 'hearts',
            'diamonds': 'diamonds',
            'clubs': 'clubs'
        };

        const rankName = rankMap[data.rank] || data.rank.toLowerCase();
        const suitName = suitMap[data.suit] || data.suit.toLowerCase();

        console.log(`      Card path: rank=${data.rank} (${rankName}), suit=${data.suit} (${suitName})`);

        return `cards2/${rankName}_of_${suitName}`;
    }

    /**
     * Show debug label as fallback (disabled - we don't reveal card info)
     */
    private showDebugLabel() {
        // Debug labels disabled to prevent revealing card information
        // If needed for debugging, temporarily enable this:
        // if (this.debugLabel && this.cardData) {
        //     this.debugLabel.node.active = true;
        //     this.debugLabel.string = `${this.cardData.rank}${this.cardData.suit}`;
        // }
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

