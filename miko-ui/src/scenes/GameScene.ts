import { Container, Sprite, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { GameManager } from '../managers/GameManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { SlotLayout } from '../components/SlotLayout.js';
import { CommunityCards } from '../components/CommunityCards.js';
import { DealerButton } from '../components/DealerButton.js';
import { StatusBar } from '../components/StatusBar.js';
import { ActionBar } from '../components/ActionBar.js';
import { FONTS } from '../utils/constants.js';

export class GameScene extends Container {
  private gameManager: GameManager | null = null;
  private actionBar: ActionBar;
  private newGameBtn: Container | null = null;

  constructor() {
    super();

    // Table background
    const table = new Sprite(AssetManager.get('table'));
    table.anchor.set(0.5);
    table.width = 960;
    table.height = 540;
    this.addChild(table);

    // Slot layout
    const slotLayout = new SlotLayout();
    this.addChild(slotLayout);

    // Community cards
    const communityCards = new CommunityCards();
    communityCards.y = -20;
    this.addChild(communityCards);

    // Dealer button
    const dealerButton = new DealerButton();
    this.addChild(dealerButton);

    // Status bar
    const statusBar = new StatusBar();
    statusBar.y = -140;
    this.addChild(statusBar);

    // Action bar
    this.actionBar = new ActionBar();
    this.actionBar.y = 320;
    this.addChild(this.actionBar);

    // New Game button (hidden initially)
    this.newGameBtn = this.createNewGameButton();
    this.newGameBtn.visible = false;
    this.addChild(this.newGameBtn);

    // Audio manager
    const audioManager = new AudioManager();

    // Game manager
    this.gameManager = new GameManager(
      slotLayout,
      communityCards,
      dealerButton,
      statusBar,
      this.actionBar,
      audioManager,
    );

    this.gameManager.onGameOver = () => {
      if (this.newGameBtn) this.newGameBtn.visible = true;
    };

    // Initialize audio then start
    audioManager.initialize().then(() => {
      this.gameManager!.start();
    });
  }

  /** Called from main.ts on window resize to reposition the HTML bet input */
  onResize(screenWidth: number, screenHeight: number, scale: number): void {
    // The action bar is at y=320 in design space, centered.
    // Convert to screen coords for the HTML input overlay.
    const inputScreenX = screenWidth / 2;
    const inputScreenY = screenHeight / 2 + 320 * scale - 50 * scale;
    this.actionBar.updateInputPosition(inputScreenX, inputScreenY);
  }

  private createNewGameButton(): Container {
    const btn = new Container();
    btn.y = 320;

    const bg = new Graphics();
    bg.roundRect(-80, -24, 160, 48, 10);
    bg.fill({ color: 0x2a6e3f, alpha: 1 });
    bg.stroke({ color: 0x4ade80, width: 2 });
    btn.addChild(bg);

    const label = new Text({ text: 'New Game', style: { ...FONTS.button, fill: 0x4ade80 } as TextStyleOptions });
    label.anchor.set(0.5);
    btn.addChild(label);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    // Hover effects
    btn.on('pointerover', () => {
      bg.clear();
      bg.roundRect(-80, -24, 160, 48, 10);
      bg.fill({ color: 0x3a8e5f, alpha: 1 });
      bg.stroke({ color: 0x4ade80, width: 2 });
    });
    btn.on('pointerout', () => {
      bg.clear();
      bg.roundRect(-80, -24, 160, 48, 10);
      bg.fill({ color: 0x2a6e3f, alpha: 1 });
      bg.stroke({ color: 0x4ade80, width: 2 });
    });

    btn.on('pointerdown', () => {
      btn.visible = false;
      this.gameManager?.restart();
    });

    return btn;
  }

  destroy(): void {
    this.actionBar.destroy();
    super.destroy();
  }
}
