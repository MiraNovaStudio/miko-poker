// (c) 2026 MiraNova Studios
import { Container, Sprite } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
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
  onQuit: (() => void) | null = null;

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

    // Audio is already initialized by main.ts — start the game
    this.gameManager.start();
  }

  /** Called from main.ts on window resize to reposition HTML overlays */
  onResize(screenWidth: number, screenHeight: number, scale: number): void {
    // The action bar is at y=320 in design space, centered.
    // Convert to screen coords for the HTML input overlay.
    const inputScreenX = screenWidth / 2;
    const inputScreenY = screenHeight / 2 + 320 * scale;
    this.actionBar.updateInputPosition(inputScreenX, inputScreenY, scale);
    this.gameManager?.onResize(screenWidth, screenHeight, scale);
  }

  destroy(): void {
    // Close modal if open
    document.getElementById('gameover-modal')?.classList.remove('open');
    this.actionBar.destroy();
    super.destroy();
  }
}
