// (c) 2026 MiraNova Studios
import { Container, Sprite } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { SettingsManager } from '../managers/SettingsManager.js';
import { GameManager } from '../managers/GameManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { SlotLayout } from '../components/SlotLayout.js';
import { CommunityCards } from '../components/CommunityCards.js';
import { DealerButton } from '../components/DealerButton.js';
import { StatusBar } from '../components/StatusBar.js';
import { ActionBar } from '../components/ActionBar.js';

export class GameScene extends Container {
  private gameManager: GameManager | null = null;
  private actionBar: ActionBar;
  private tableSprite: Sprite;
  onQuit: (() => void) | null = null;

  constructor() {
    super();

    // Table background
    const tableAlias = SettingsManager.instance.tableStyle === 'table2' ? 'table2' : 'table';
    this.tableSprite = new Sprite(AssetManager.get(tableAlias));
    this.tableSprite.anchor.set(0.5);
    this.tableSprite.width = 960;
    this.tableSprite.height = 540;
    this.addChild(this.tableSprite);

    // Slot layout
    const slotLayout = new SlotLayout();
    this.addChild(slotLayout);

    // Community cards
    const communityCards = new CommunityCards();
    communityCards.y = -30;
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

    // Game manager (uses shared AudioManager singleton)
    const audioManager = AudioManager.instance;

    this.gameManager = new GameManager(
      slotLayout,
      communityCards,
      dealerButton,
      statusBar,
      this.actionBar,
      audioManager,
    );

    // Wire game-over to HTML modal
    const gameoverModal = document.getElementById('gameover-modal');
    const gameoverMessage = document.getElementById('gameover-message');
    const newGameBtn = document.getElementById('new-game-btn');
    const rebuyBtn = document.getElementById('rebuy-btn');
    const quitBtn = document.getElementById('quit-btn');

    this.gameManager.onGameOver = (message?: string) => {
      if (gameoverMessage && message) gameoverMessage.textContent = message;

      // Player eliminated → show Rebuy + Quit; player won → show New Game
      const eliminated = message?.includes('ran out of chips');
      if (rebuyBtn) rebuyBtn.style.display = eliminated ? 'inline-block' : 'none';
      if (quitBtn) quitBtn.style.display = eliminated ? 'inline-block' : 'none';
      if (newGameBtn) newGameBtn.style.display = eliminated ? 'none' : 'inline-block';

      gameoverModal?.classList.add('open');
    };

    if (gameoverModal) {
      newGameBtn?.addEventListener('click', () => {
        gameoverModal.classList.remove('open');
        this.gameManager?.restart();
      });

      rebuyBtn?.addEventListener('click', () => {
        gameoverModal.classList.remove('open');
        this.gameManager?.rebuy();
      });

      quitBtn?.addEventListener('click', () => {
        gameoverModal.classList.remove('open');
        this.onQuit?.();
      });
    }

    // Update table texture when settings change
    SettingsManager.instance.onChange(() => this.updateTableTexture());

    // Audio is already initialized by main.ts — start the game
    this.gameManager.start();
  }

  /** Swap table background texture based on current setting. */
  private updateTableTexture(): void {
    const alias = SettingsManager.instance.tableStyle === 'table2' ? 'table2' : 'table';
    this.tableSprite.texture = AssetManager.get(alias);
  }

  /** Called from main.ts on window resize to reposition HTML overlays.
   *  sceneCenterY is the actual Y coordinate of the scene's origin on screen. */
  onResize(screenWidth: number, sceneCenterY: number, scale: number): void {
    // The action bar is at y=320 in design space, centered.
    // Convert to screen coords for the HTML input overlay.
    const inputScreenX = screenWidth / 2;
    const inputScreenY = sceneCenterY + 320 * scale;
    this.actionBar.updateInputPosition(inputScreenX, inputScreenY, scale);
    this.gameManager?.onResize(screenWidth, sceneCenterY, scale);
  }

  destroy(): void {
    // Close modal if open
    document.getElementById('gameover-modal')?.classList.remove('open');
    this.actionBar.destroy();
    super.destroy();
  }
}
