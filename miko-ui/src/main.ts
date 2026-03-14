// (c) 2026 MiraNova Studios
import { Application } from 'pixi.js';
import { AssetManager } from './managers/AssetManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { SettingsManager, type DeckType } from './managers/SettingsManager.js';
import { StartScene } from './scenes/StartScene.js';
import { GameScene } from './scenes/GameScene.js';

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
    soundBtn.addEventListener('click', () => {
      audio.muted = !audio.muted;
      updateIcon();
    });
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

    // Player name input
    const nameInput = document.getElementById('player-name') as HTMLInputElement | null;
    if (nameInput) {
      nameInput.value = settings.playerName;
      nameInput.addEventListener('input', () => {
        settings.playerName = nameInput.value;
      });
    }

    // Sync button state with saved preference on load
    updateDeckButtons();
    updateFourColorButtons();
    updateChipButtons();
    updateAnimButtons();
    updateTableButtons();
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
      if (pageTitle) pageTitle.style.display = 'none';
      if (copyrightEl) copyrightEl.style.display = 'block';
    } else {
      if (soundBtn) soundBtn.style.display = 'flex';
      if (settingsBtn) settingsBtn.style.display = 'flex';
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
    if (soundBtn) soundBtn.style.display = 'none';
    if (settingsBtn) settingsBtn.style.display = 'none';
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
    if (pageTitle) pageTitle.style.display = 'block';
    if (copyrightEl) copyrightEl.style.display = 'none';
    const game = new GameScene(app.renderer);
    game.onQuit = () => showStartScene();
    currentScene = game;
    app.stage.addChild(game);
    layoutScene();
  }

  window.addEventListener('resize', layoutScene);
  app.renderer.on('resize', layoutScene);

  // Start with the start screen
  showStartScene();

  console.log('MikoPoker UI initialized');
}

init().catch(console.error);
