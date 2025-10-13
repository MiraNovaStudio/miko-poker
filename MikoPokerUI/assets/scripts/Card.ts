/**
 * Card Component - Represents a single playing card
 * Can display either face-up (showing rank/suit) or face-down (card back)
 */

import { _decorator, Component, Sprite, SpriteFrame, Label, UITransform, Color, resources, Material } from 'cc';
const { ccclass, property } = _decorator;

export interface CardData {
    rank: string;
    suit: string;
}

@ccclass('Card')
export class Card extends Component {
    @property(Sprite)
    cardSprite: Sprite | null = null;

    @property(Label)
    debugLabel: Label | null = null;

    @property
    cardWidth: number = 80;

    @property
    cardHeight: number = 112;

    private isFaceUp: boolean = false;
    private cardData: CardData | null = null;

    onLoad() {
        if (!this.cardSprite) {
            this.cardSprite = this.node.getComponent(Sprite);
            if (!this.cardSprite) {
                console.error('No Sprite component found on Card prefab!');
            }
        }

        // Ensure sprite uses CUSTOM sizing so content size isn't reset to native on frame changes
        if (this.cardSprite) {
            this.cardSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
    }

    start() {
        if (this.debugLabel) {
            this.debugLabel.node.active = false;
        }
    }

    setCard(data: CardData, faceUp: boolean = true) {
        console.log(`Card.setCard called: ${data.rank}${data.suit}, faceUp: ${faceUp}`);

        if (!this.cardSprite) {
            this.cardSprite = this.node.getComponent(Sprite);
            if (!this.cardSprite) {
                console.error('CRITICAL: No Sprite component on card node!');
                return;
            }
        }

        this.cardData = data;
        this.isFaceUp = faceUp;
        this.updateDisplay();
    }

    showFace() {
        this.isFaceUp = true;
        this.updateDisplay();
    }

    showBack() {
        this.isFaceUp = false;
        this.updateDisplay();
    }

    flip() {
        this.isFaceUp = !this.isFaceUp;
        this.updateDisplay();
    }

    private updateDisplay() {
        if (!this.cardSprite || !this.cardData) return;

        if (this.isFaceUp) {
            this.loadCardFace();
        } else {
            this.loadCardBack();
        }

        if (this.debugLabel) {
            this.debugLabel.node.active = false;
        }
    }

    private loadCardFace() {
        if (!this.cardData) return;

        const path = this.getCardResourcePath(this.cardData) + '/spriteFrame';
        resources.load(path, SpriteFrame, (err, spriteFrame) => {
            if (!this.node || !this.node.isValid) return;

            if (err) {
                console.error(`Failed to load card: ${path}`, err);
                this.showDebugLabel();
                return;
            }

            if (this.cardSprite && this.cardSprite.isValid) {
                this.cardSprite.sizeMode = Sprite.SizeMode.CUSTOM; // set mode first
                this.cardSprite.spriteFrame = spriteFrame;
                // Re-apply desired size after spriteFrame assignment
                this.setSize(this.cardWidth, this.cardHeight);
            }
        });
    }

    private loadCardBack() {
        resources.load('card_back/spriteFrame', SpriteFrame, (err, spriteFrame) => {
            if (!this.node || !this.node.isValid) return;

            if (err) {
                console.error('Failed to load card back', err);
                this.showDebugLabel();
                return;
            }

            if (this.cardSprite && this.cardSprite.isValid) {
                this.cardSprite.sizeMode = Sprite.SizeMode.CUSTOM; // set mode first
                this.cardSprite.spriteFrame = spriteFrame;
                // Re-apply desired size after spriteFrame assignment
                this.setSize(this.cardWidth, this.cardHeight);
            }
        });
    }

    private getCardResourcePath(data: CardData): string {
        const rankMap: Record<string, string> = {
            'A': 'ace', 'K': 'king', 'Q': 'queen', 'J': 'jack',
            '10': '10', '9': '9', '8': '8', '7': '7', '6': '6',
            '5': '5', '4': '4', '3': '3', '2': '2'
        };

        const suitMap: Record<string, string> = {
            'spades': 'spades',
            'hearts': 'hearts',
            'diamonds': 'diamonds',
            'clubs': 'clubs'
        };

        const rankName = rankMap[data.rank] || data.rank.toLowerCase();
        const suitName = suitMap[data.suit] || data.suit.toLowerCase();

        return `deck4/${rankName}_of_${suitName}`;
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

    public setSize(width: number, height: number) {
        this.cardWidth = width;
        this.cardHeight = height;

        const rootTransform = this.node.getComponent(UITransform);
        if (rootTransform) {
            rootTransform.setContentSize(width, height);
        }

        if (this.cardSprite && this.cardSprite.node && this.cardSprite.node.isValid) {
            const spriteTransform = this.cardSprite.node.getComponent(UITransform);
            if (spriteTransform) {
                spriteTransform.setContentSize(width, height);
            }
        }
    }

    getCardData(): CardData | null { return this.cardData; }
    isFaceUpCard(): boolean { return this.isFaceUp; }
}
