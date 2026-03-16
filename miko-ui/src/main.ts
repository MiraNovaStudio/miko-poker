// (c) 2026 MiraNova Studios
import { Application } from 'pixi.js';
import { AssetManager } from './managers/AssetManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { SettingsManager, type DeckType } from './managers/SettingsManager.js';
import { StartScene } from './scenes/StartScene.js';
import { GameScene } from './scenes/GameScene.js';
import { createAvatar, AVATAR_PRESETS } from './utils/createAvatar.js';
import { CARD_BACK_DESIGNS, type CardBackDesign } from './components/Card.js';
import { DEBUG_ENABLED, setDebugEnabled } from '@engine/index.js';

/** Set to true to show the music player button. Disabled pending music licensing review. */
const SHOW_MUSIC_BUTTON = true;

/** Design resolution the layout was authored for */
const DESIGN_WIDTH = 960;
const DESIGN_HEIGHT = 720;

const app = new Application();

async function init() {
  await app.init({
    background: '#1a1a2e',
    resizeTo: window,
    antialias: true,
  });

  const canvasEl = document.getElementById('game-canvas');
  if (!canvasEl) throw new Error('Missing #game-canvas element');
  canvasEl.appendChild(app.canvas);

  // Load all textures
  await AssetManager.load();

  // Shared audio manager (singleton, persists across scenes)
  const audio = AudioManager.instance;
  await audio.initialize();

  // Sound mute toggle button (HTML overlay, top-right — hidden on start screen)
  const soundBtn = document.getElementById('sound-toggle');
  if (soundBtn) {
    soundBtn.style.display = 'none'; // hidden on start screen
    const updateIcon = () => {
      soundBtn.innerHTML = audio.muted ? '&#x1F507;' : '&#x1F50A;';
    };
    updateIcon(); // reflect persisted mute state
    soundBtn.addEventListener('click', () => {
      audio.setMuted(!audio.muted);
      updateIcon();
    });
  }

  // Music toggle button (HTML overlay, top-right — hidden on start screen)
  const musicBtn = document.getElementById('music-toggle');
  if (musicBtn) {
    musicBtn.style.display = 'none';
    const updateMusicLabel = (playing: boolean) => {
      musicBtn.innerHTML = playing ? '&#x25A0; Music' : '&#x25B6; Music';
      musicBtn.title = playing ? 'Stop Music' : 'Play Music';
    };
    musicBtn.addEventListener('click', () => {
      audio.toggleMusic();
    });
    audio.onMusicStateChange = updateMusicLabel;
  }

  // Settings button and modal
  const settings = SettingsManager.instance;
  const settingsBtn = document.getElementById('settings-toggle');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const deckPngBtn = document.getElementById('deck-png');
  const deckUnicodeBtn = document.getElementById('deck-unicode');
  const chipDollarBtn = document.getElementById('chip-dollar');
  const chipBbBtn = document.getElementById('chip-bb');
  const animsOnBtn = document.getElementById('anims-on');
  const animsOffBtn = document.getElementById('anims-off');
  const fourColorOnBtn = document.getElementById('fourcolor-on');
  const fourColorOffBtn = document.getElementById('fourcolor-off');
  const fourColorRow = document.getElementById('four-color-row');
  const table1Btn = document.getElementById('table-1');
  const table2Btn = document.getElementById('table-2');

  if (settingsBtn && settingsModal) {
    settingsBtn.style.display = 'none'; // hidden on start screen

    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('open');
    });

    settingsClose?.addEventListener('click', () => {
      settingsModal.classList.remove('open');
    });

    // Close modal when clicking backdrop
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.remove('open');
    });

    // Deck type selection
    const updateDeckButtons = () => {
      deckPngBtn?.classList.toggle('active', settings.deckType === 'png');
      deckUnicodeBtn?.classList.toggle('active', settings.deckType === 'unicode');
      // 4-Color Deck only available with Unicode deck
      const isUnicode = settings.deckType === 'unicode';
      if (fourColorRow) {
        fourColorRow.style.opacity = isUnicode ? '1' : '0.4';
        fourColorRow.style.pointerEvents = isUnicode ? 'auto' : 'none';
      }
      if (!isUnicode && settings.fourColorDeck) {
        settings.fourColorDeck = false;
        updateFourColorButtons();
      }
    };

    deckPngBtn?.addEventListener('click', () => {
      settings.deckType = 'png';
      updateDeckButtons();
    });

    deckUnicodeBtn?.addEventListener('click', () => {
      settings.deckType = 'unicode';
      updateDeckButtons();
    });

    // Chip display selection
    const updateChipButtons = () => {
      chipDollarBtn?.classList.toggle('active', settings.chipDisplay === 'dollar');
      chipBbBtn?.classList.toggle('active', settings.chipDisplay === 'bb');
    };

    chipDollarBtn?.addEventListener('click', () => {
      settings.chipDisplay = 'dollar';
      updateChipButtons();
    });

    chipBbBtn?.addEventListener('click', () => {
      settings.chipDisplay = 'bb';
      updateChipButtons();
    });

    // Card animations toggle
    const updateAnimButtons = () => {
      animsOnBtn?.classList.toggle('active', settings.cardAnimations);
      animsOffBtn?.classList.toggle('active', !settings.cardAnimations);
    };

    animsOnBtn?.addEventListener('click', () => {
      settings.cardAnimations = true;
      updateAnimButtons();
    });

    animsOffBtn?.addEventListener('click', () => {
      settings.cardAnimations = false;
      updateAnimButtons();
    });

    // 4-Color Deck toggle (Unicode only)
    const updateFourColorButtons = () => {
      fourColorOnBtn?.classList.toggle('active', settings.fourColorDeck);
      fourColorOffBtn?.classList.toggle('active', !settings.fourColorDeck);
    };

    fourColorOnBtn?.addEventListener('click', () => {
      settings.fourColorDeck = true;
      updateFourColorButtons();
    });

    fourColorOffBtn?.addEventListener('click', () => {
      settings.fourColorDeck = false;
      updateFourColorButtons();
    });

    // Table style selection
    const updateTableButtons = () => {
      table1Btn?.classList.toggle('active', settings.tableStyle === 'table1');
      table2Btn?.classList.toggle('active', settings.tableStyle === 'table2');
    };

    table1Btn?.addEventListener('click', () => {
      settings.tableStyle = 'table1';
      updateTableButtons();
    });

    table2Btn?.addEventListener('click', () => {
      settings.tableStyle = 'table2';
      updateTableButtons();
    });

    // Shuffle music setting
    const shuffleOnBtn = document.getElementById('shuffle-on');
    const shuffleOffBtn = document.getElementById('shuffle-off');
    const updateShuffleButtons = () => {
      shuffleOnBtn?.classList.toggle('active', audio.shuffle);
      shuffleOffBtn?.classList.toggle('active', !audio.shuffle);
    };
    shuffleOnBtn?.addEventListener('click', () => {
      audio.setShuffle(true);
      updateShuffleButtons();
    });
    shuffleOffBtn?.addEventListener('click', () => {
      audio.setShuffle(false);
      updateShuffleButtons();
    });
    updateShuffleButtons(); // reflect persisted shuffle state

    // Player name input
    const nameInput = document.getElementById('player-name') as HTMLInputElement | null;
    if (nameInput) {
      nameInput.value = settings.playerName;
      nameInput.addEventListener('input', () => {
        settings.playerName = nameInput.value;
      });
    }

    // Avatar picker
    const avatarPreview = document.getElementById('avatar-preview') as HTMLCanvasElement | null;
    const avatarChooseBtn = document.getElementById('avatar-choose-btn');
    const avatarModal = document.getElementById('avatar-modal');
    const avatarGrid = document.getElementById('avatar-grid');
    const avatarClose = document.getElementById('avatar-close');

    /** Render a PixiJS avatar container to a target canvas element. */
    function renderAvatarToCanvas(seed: string, gender: 'male' | 'female', target: HTMLCanvasElement): void {
      const container = createAvatar(seed, gender);
      // Generate texture via the app renderer, then extract pixels
      const tex = app.renderer.generateTexture(container);
      const extract = app.renderer.extract;
      const extractCanvas = extract.canvas(tex) as HTMLCanvasElement;
      const ctx = target.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(extractCanvas, 0, 0, target.width, target.height);
      }
      container.destroy(true);
      tex.destroy(true);
    }

    /** Update the small avatar preview in the settings row. */
    function updateAvatarPreview(): void {
      if (!avatarPreview) return;
      const presetId = settings.avatarPreset;
      const preset = AVATAR_PRESETS.find(p => p.id === presetId) ?? AVATAR_PRESETS[0];
      renderAvatarToCanvas(preset.seed, preset.gender, avatarPreview);
    }

    /** Build the avatar picker grid. */
    function buildAvatarGrid(): void {
      if (!avatarGrid) return;
      avatarGrid.innerHTML = '';
      for (const preset of AVATAR_PRESETS) {
        const cell = document.createElement('div');
        cell.className = 'avatar-option';
        if (preset.id === settings.avatarPreset) cell.classList.add('selected');
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        cell.appendChild(canvas);
        avatarGrid.appendChild(cell);

        // Render avatar onto the cell canvas
        renderAvatarToCanvas(preset.seed, preset.gender, canvas);

        cell.addEventListener('click', () => {
          settings.avatarPreset = preset.id;
          // Update selection highlight
          avatarGrid!.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
          cell.classList.add('selected');
          updateAvatarPreview();
        });
      }
    }

    avatarChooseBtn?.addEventListener('click', () => {
      buildAvatarGrid();
      avatarModal?.classList.add('open');
    });

    avatarClose?.addEventListener('click', () => {
      avatarModal?.classList.remove('open');
    });

    avatarModal?.addEventListener('click', (e) => {
      if (e.target === avatarModal) avatarModal.classList.remove('open');
    });

    // Card back picker
    const cardbackPreview = document.getElementById('cardback-preview') as HTMLCanvasElement | null;
    const cardbackChooseBtn = document.getElementById('cardback-choose-btn');
    const cardbackModal = document.getElementById('cardback-modal');
    const cardbackGrid = document.getElementById('cardback-grid');
    const cardbackClose = document.getElementById('cardback-close');

    /** Draw a card back design onto a 2D canvas. */
    function drawCardBackToCanvas(design: CardBackDesign, canvas: HTMLCanvasElement): void {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const r = 4;
      const inset = w * 0.08;

      ctx.clearRect(0, 0, w, h);

      // Helper: hex number to CSS color
      const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

      // Outer shape
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, r);
      ctx.fillStyle = hex(design.color);
      ctx.fill();
      ctx.strokeStyle = hex(design.border);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner border
      ctx.beginPath();
      ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(r - 2, 2));
      ctx.strokeStyle = hex(design.border);
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;

      const cx = w / 2;
      const cy = h / 2;

      // Pattern
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = hex(design.pattern);
      switch (design.style) {
        case 'diamond': {
          const dw = w * 0.18;
          const dh = h * 0.14;
          ctx.beginPath();
          ctx.moveTo(cx, cy - dh);
          ctx.lineTo(cx + dw, cy);
          ctx.lineTo(cx, cy + dh);
          ctx.lineTo(cx - dw, cy);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'cross': {
          const armW = w * 0.1;
          const armH = h * 0.22;
          ctx.fillRect(cx - armW / 2, cy - armH, armW, armH * 2);
          ctx.fillRect(cx - armH * 0.6, cy - armW / 2, armH * 1.2, armW);
          break;
        }
        case 'stripes': {
          const sw = w * 0.07;
          const gap = w * 0.16;
          for (let i = -1; i <= 1; i++) {
            ctx.fillRect(cx + i * gap - sw / 2, inset + 2, sw, h - inset * 2 - 4);
          }
          break;
        }
        case 'oval': {
          ctx.beginPath();
          ctx.ellipse(cx, cy, w * 0.2, h * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
      ctx.globalAlpha = 1;
    }

    function updateCardbackPreview(): void {
      if (!cardbackPreview) return;
      const design = CARD_BACK_DESIGNS.find(d => d.id === settings.cardBack) ?? CARD_BACK_DESIGNS[0];
      drawCardBackToCanvas(design, cardbackPreview);
    }

    function buildCardbackGrid(): void {
      if (!cardbackGrid) return;
      cardbackGrid.innerHTML = '';
      for (const design of CARD_BACK_DESIGNS) {
        const cell = document.createElement('div');
        cell.className = 'cardback-option';
        if (design.id === settings.cardBack) cell.classList.add('selected');
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 68;
        cell.appendChild(canvas);
        cardbackGrid.appendChild(cell);

        drawCardBackToCanvas(design, canvas);

        cell.addEventListener('click', () => {
          settings.cardBack = design.id;
          cardbackGrid!.querySelectorAll('.cardback-option').forEach(el => el.classList.remove('selected'));
          cell.classList.add('selected');
          updateCardbackPreview();
        });
      }
    }

    cardbackChooseBtn?.addEventListener('click', () => {
      buildCardbackGrid();
      cardbackModal?.classList.add('open');
    });

    cardbackClose?.addEventListener('click', () => {
      cardbackModal?.classList.remove('open');
    });

    cardbackModal?.addEventListener('click', (e) => {
      if (e.target === cardbackModal) cardbackModal.classList.remove('open');
    });

    // Sync button state with saved preference on load
    updateDeckButtons();
    updateFourColorButtons();
    updateChipButtons();
    updateAnimButtons();
    updateTableButtons();
    updateAvatarPreview();
    updateCardbackPreview();
  }

  // About modal (click page title to open)
  const aboutModal = document.getElementById('about-modal');
  const aboutClose = document.getElementById('about-close');
  const aboutVersion = document.getElementById('about-version-number');
  const pageTitle = document.getElementById('page-title');
  const copyrightEl = document.getElementById('copyright');
  const mobileGate = document.getElementById('mobile-gate');
  const gameCanvas = document.getElementById('game-canvas');

  if (aboutVersion) {
    aboutVersion.textContent = __APP_VERSION__;
  }

  if (pageTitle && aboutModal) {
    pageTitle.addEventListener('click', () => {
      aboutModal.classList.add('open');
    });
    aboutClose?.addEventListener('click', () => {
      aboutModal.classList.remove('open');
    });
  }

  const MOBILE_BREAKPOINT = 500;

  let currentScene: StartScene | GameScene | null = null;

  /** Show mobile gate and hide everything else when viewport is too narrow. */
  function updateMobileGate() {
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (mobileGate) mobileGate.style.display = isMobile ? 'flex' : 'none';
    if (gameCanvas) gameCanvas.style.display = isMobile ? 'none' : 'block';
    if (isMobile) {
      if (pageTitle) pageTitle.style.display = 'none';
      if (copyrightEl) copyrightEl.style.display = 'none';
      if (soundBtn) soundBtn.style.display = 'none';
      if (settingsBtn) settingsBtn.style.display = 'none';
      if (musicBtn) musicBtn.style.display = 'none';
    } else {
      restoreUIForScreen();
    }
  }

  /** Center the scene and scale it to fit the viewport while preserving aspect ratio. */
  function layoutScene() {
    updateMobileGate();
    if (!currentScene) return;
    if (window.innerWidth < MOBILE_BREAKPOINT) return;

    // Use window dimensions directly as fallback in case app.screen hasn't updated yet
    const w = app.screen.width || window.innerWidth;
    const h = app.screen.height || window.innerHeight;

    const scaleX = w / DESIGN_WIDTH;
    const scaleY = h / DESIGN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    const scaledH = DESIGN_HEIGHT * scale;

    currentScene.scale.set(scale);
    currentScene.x = w / 2;
    // Center horizontally, but anchor to top when viewport is taller than needed
    currentScene.y = h > scaledH ? scaledH / 2 : h / 2;

    // Notify the game scene so the HTML bet input can reposition.
    // Pass the actual scene center (not raw screen center) so overlays align correctly.
    const sceneCenterY = currentScene.y;
    if (currentScene instanceof GameScene) {
      currentScene.onResize(w, sceneCenterY, scale);
    }
  }

  let activeScreen: 'start' | 'game' = 'start';

  /** Restore UI element visibility for the active screen (after mobile gate hides them). */
  function restoreUIForScreen() {
    if (window.innerWidth < MOBILE_BREAKPOINT) return;
    if (activeScreen === 'start') {
      if (soundBtn) soundBtn.style.display = 'none';
      if (settingsBtn) settingsBtn.style.display = 'none';
      if (musicBtn) musicBtn.style.display = 'none';
      if (pageTitle) pageTitle.style.display = 'none';
      if (copyrightEl) copyrightEl.style.display = 'block';
    } else {
      if (soundBtn) soundBtn.style.display = 'flex';
      if (settingsBtn) settingsBtn.style.display = 'flex';
      if (musicBtn) musicBtn.style.display = SHOW_MUSIC_BUTTON ? 'flex' : 'none';
      if (pageTitle) pageTitle.style.display = 'block';
      if (copyrightEl) copyrightEl.style.display = 'none';
    }
  }

  function showStartScene() {
    if (currentScene) {
      app.stage.removeChild(currentScene);
      currentScene.destroy();
    }
    activeScreen = 'start';
    audio.stopMusic();
    if (soundBtn) soundBtn.style.display = 'none';
    if (settingsBtn) settingsBtn.style.display = 'none';
    if (musicBtn) musicBtn.style.display = 'none';
    if (pageTitle) pageTitle.style.display = 'none';
    if (copyrightEl) copyrightEl.style.display = 'block';
    const start = new StartScene();
    currentScene = start;
    app.stage.addChild(start);
    layoutScene();

    start.onStart = () => showGameScene();
  }

  function showGameScene() {
    if (currentScene) {
      app.stage.removeChild(currentScene);
      currentScene.destroy();
    }
    activeScreen = 'game';
    if (soundBtn) soundBtn.style.display = 'flex';
    if (settingsBtn) settingsBtn.style.display = 'flex';
    if (musicBtn) musicBtn.style.display = SHOW_MUSIC_BUTTON ? 'flex' : 'none';
    if (pageTitle) pageTitle.style.display = 'block';
    if (copyrightEl) copyrightEl.style.display = 'none';
    const game = new GameScene(app.renderer);
    game.onQuit = () => showStartScene();
    currentScene = game;
    app.stage.addChild(game);
    layoutScene();

    // Debug: expose test helpers on window
    (window as any).debugEndgame = () => game.gameManager?.debugEndgame();
    (window as any).debugClearTable = () => game.gameManager?.debugClearTable();
    (window as any).debugSetChips = (n: number) => game.gameManager?.debugSetChips(n);
    (window as any).debugAces = () => game.gameManager?.debugAces();
    (window as any).debugMikoKO = () => game.gameManager?.debugMikoKO();
    (window as any).debugFastMode = () => game.gameManager?.debugFastMode();
    (window as any).debugHideCards = () => game.gameManager?.debugHideCards();
    (window as any).debugClearStorage = () => {
      localStorage.clear();
      console.log('🗑️ localStorage cleared. Reload the page to apply defaults.');
    };
    (window as any).debugLogs = () => {
      const newState = !DEBUG_ENABLED;
      setDebugEnabled(newState);
      console.log(`🔧 Debug logs: ${newState ? 'ON' : 'OFF'}`);
    };
  }

  window.addEventListener('resize', layoutScene);
  app.renderer.on('resize', layoutScene);

  // Start with the start screen
  showStartScene();

  console.log('MikoPoker UI initialized');
}

init().catch(console.error);
