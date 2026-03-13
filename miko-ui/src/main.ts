import { Application } from 'pixi.js';
import { AssetManager } from './managers/AssetManager.js';
import { AudioManager } from './managers/AudioManager.js';
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

  // Music toggle button (HTML overlay, top-right of viewport)
  const musicBtn = document.getElementById('music-toggle');
  if (musicBtn) {
    const updateIcon = () => {
      musicBtn.innerHTML = audio.musicPlaying ? '&#x1F50A;' : '&#x1F507;';
    };
    musicBtn.addEventListener('click', () => {
      if (audio.musicPlaying) {
        audio.stopMusic();
      } else {
        audio.playMusic(0.2);
      }
      updateIcon();
    });
  }

  let currentScene: StartScene | GameScene | null = null;

  /** Center the scene and scale it to fit the viewport while preserving aspect ratio. */
  function layoutScene() {
    if (!currentScene) return;

    const scaleX = app.screen.width / DESIGN_WIDTH;
    const scaleY = app.screen.height / DESIGN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    currentScene.scale.set(scale);
    currentScene.x = app.screen.width / 2;
    currentScene.y = app.screen.height / 2;

    // Notify the game scene so the HTML bet input can reposition
    if (currentScene instanceof GameScene) {
      currentScene.onResize(app.screen.width, app.screen.height, scale);
    }
  }

  function showStartScene() {
    if (currentScene) {
      app.stage.removeChild(currentScene);
      currentScene.destroy();
    }
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
    const game = new GameScene();
    currentScene = game;
    app.stage.addChild(game);
    layoutScene();
  }

  window.addEventListener('resize', layoutScene);

  // Start with the start screen
  showStartScene();

  console.log('MikoPoker UI initialized');
}

init().catch(console.error);
