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
    };

    deckPngBtn?.addEventListener('click', () => {
      settings.deckType = 'png';
      updateDeckButtons();
    });

    deckUnicodeBtn?.addEventListener('click', () => {
      settings.deckType = 'unicode';
      updateDeckButtons();
    });
  }

  const pageTitle = document.getElementById('page-title');
  const copyrightEl = document.getElementById('copyright');

  let currentScene: StartScene | GameScene | null = null;

  /** Center the scene and scale it to fit the viewport while preserving aspect ratio. */
  function layoutScene() {
    if (!currentScene) return;

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

    // Notify the game scene so the HTML bet input can reposition
    if (currentScene instanceof GameScene) {
      currentScene.onResize(w, h, scale);
    }
  }

  function showStartScene() {
    if (currentScene) {
      app.stage.removeChild(currentScene);
      currentScene.destroy();
    }
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
    if (soundBtn) soundBtn.style.display = 'flex';
    if (settingsBtn) settingsBtn.style.display = 'flex';
    if (pageTitle) pageTitle.style.display = 'block';
    if (copyrightEl) copyrightEl.style.display = 'none';
    const game = new GameScene();
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
