// (c) 2026 MiraNova Studios
import { Container, Sprite, type Renderer } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { SettingsManager } from '../managers/SettingsManager.js';
import { GameManager } from '../managers/GameManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { SlotLayout } from '../components/SlotLayout.js';
import { CommunityCards } from '../components/CommunityCards.js';
import { DealerButton } from '../components/DealerButton.js';
import { StatusBar } from '../components/StatusBar.js';
import { ActionBar } from '../components/ActionBar.js';
import { PotChips } from '../components/PotChips.js';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

export class GameScene extends Container {
  gameManager: GameManager | null = null;
  private actionBar: ActionBar;
  private tableSprite: Sprite;
  onQuit: (() => void) | null = null;
  private fireworksId: number | null = null;

  constructor(renderer: Renderer) {
    super();
    this.sortableChildren = true;

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

    // Pot chips (visual chip stack above pot label)
    const potChips = new PotChips();
    potChips.x = -410;   // aligned with pot label x
    potChips.y = -140 + -105 - 20; // statusBar.y + potLabel.y - offset above label
    potChips.zIndex = 2;
    this.addChild(potChips);

    // Status bar (zIndex 2 so pot labels render above player slots when side pots grow down)
    const statusBar = new StatusBar();
    statusBar.y = -140;
    statusBar.zIndex = 2;
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
      renderer,
      potChips,
    );

    // Wire game-over to HTML modal
    const gameoverModal = document.getElementById('gameover-modal');
    const gameoverMessage = document.getElementById('gameover-message');
    const newGameBtn = document.getElementById('new-game-btn');
    const rebuyBtn = document.getElementById('rebuy-btn');
    const quitBtn = document.getElementById('quit-btn');
    const keepPlayingBtn = document.getElementById('keep-playing-btn');

    this.gameManager.onGameOver = (message?: string) => {
      if (gameoverMessage && message) gameoverMessage.textContent = message;

      // Player eliminated → show Rebuy + Quit; player won → show victory + Keep Playing + New Game
      const eliminated = message?.includes('ran out of chips');
      const victory = message?.includes('eliminated all opponents') || message?.includes('knocked out MikoPoker');
      const allEliminated = message?.includes('eliminated all opponents');
      const mikoKO = message?.includes('knocked out MikoPoker');
      const canContinue = victory && !allEliminated && !mikoKO && this.gameManager?.canKeepPlaying();
      if (rebuyBtn) rebuyBtn.style.display = eliminated ? 'inline-block' : 'none';
      if (quitBtn) quitBtn.style.display = eliminated ? 'inline-block' : 'none';
      if (keepPlayingBtn) keepPlayingBtn.style.display = canContinue ? 'inline-block' : 'none';
      if (newGameBtn) newGameBtn.style.display = eliminated ? 'none' : 'inline-block';

      if (victory && gameoverModal) {
        gameoverModal.classList.add('victory');
        this.startFireworks();
      }

      gameoverModal?.classList.add('open');
    };

    if (gameoverModal) {
      newGameBtn?.addEventListener('click', () => {
        gameoverModal.classList.remove('open', 'victory');
        this.stopFireworks();
        this.gameManager?.restart();
      });

      rebuyBtn?.addEventListener('click', () => {
        gameoverModal.classList.remove('open', 'victory');
        this.stopFireworks();
        this.gameManager?.rebuy();
      });

      keepPlayingBtn?.addEventListener('click', () => {
        gameoverModal.classList.remove('open', 'victory');
        this.stopFireworks();
        this.gameManager?.keepPlaying();
      });

      quitBtn?.addEventListener('click', () => {
        gameoverModal.classList.remove('open', 'victory');
        this.stopFireworks();
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

  private fireworksSoundTimer: ReturnType<typeof setTimeout> | null = null;

  private startFireworks(): void {
    // Start fireworks sound loop after a delay (let victory sound play first)
    this.fireworksSoundTimer = setTimeout(() => {
      AudioManager.instance.playFireworksLoop();
    }, 2000);

    const canvas = document.getElementById('fireworks-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    const colors = ['#ffd700', '#ff4500', '#ff1493', '#00ff88', '#00bfff', '#ff69b4', '#fff', '#ffa500'];

    const spawnBurst = () => {
      const cx = Math.random() * canvas.width;
      const cy = Math.random() * canvas.height * 0.6;
      const count = 40 + Math.floor(Math.random() * 30);
      const color = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 60 + Math.random() * 40,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    };

    let frameCount = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn new bursts periodically
      frameCount++;
      if (frameCount % 30 === 0) spawnBurst();
      if (frameCount % 45 === 15) spawnBurst();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // gravity
        p.vx *= 0.99; // drag
        p.life++;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      this.fireworksId = requestAnimationFrame(animate);
    };

    // Initial bursts
    spawnBurst();
    setTimeout(() => spawnBurst(), 200);
    setTimeout(() => spawnBurst(), 400);
    this.fireworksId = requestAnimationFrame(animate);
  }

  private stopFireworks(): void {
    if (this.fireworksId !== null) {
      cancelAnimationFrame(this.fireworksId);
      this.fireworksId = null;
    }
    if (this.fireworksSoundTimer) {
      clearTimeout(this.fireworksSoundTimer);
      this.fireworksSoundTimer = null;
    }
    AudioManager.instance.stopFireworksLoop();
    const canvas = document.getElementById('fireworks-canvas') as HTMLCanvasElement | null;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  destroy(): void {
    this.stopFireworks();
    // Close modal if open
    document.getElementById('gameover-modal')?.classList.remove('open', 'victory');
    this.actionBar.destroy();
    this.gameManager?.destroy();
    super.destroy();
  }
}
