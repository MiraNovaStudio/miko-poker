/**
 * Game mode management and blind structures
 */

export type GameType = 'cash' | 'sng' | 'tournament';

/**
 * Blind level structure for tournaments
 */
export interface BlindLevel {
  /** Level number (1, 2, 3, ...) */
  level: number;
  /** Small blind amount */
  smallBlind: number;
  /** Big blind amount */
  bigBlind: number;
  /** Big blind ante amount (0 if no ante) */
  ante: number;
  /** Duration in minutes */
  durationMinutes: number;
}

/**
 * Tournament blind structure
 */
export interface BlindStructure {
  /** Name of the structure */
  name: string;
  /** Starting chip count */
  startingChips: number;
  /** Array of blind levels */
  levels: BlindLevel[];
}

/**
 * Game mode configuration
 */
export interface GameModeConfig {
  /** Type of game */
  type: GameType;
  /** For tournaments: blind structure */
  blindStructure?: BlindStructure;
  /** For tournaments: current blind level (0-indexed) */
  currentLevel?: number;
  /** For cash games: buy-in amount */
  buyInAmount?: number;
  /** For cash games: whether to allow rebuys */
  allowRebuys?: boolean;
}

/**
 * Standard tournament structures
 */
export const STANDARD_STRUCTURES: Record<string, BlindStructure> = {
  turbo: {
    name: 'Turbo',
    startingChips: 1500,
    levels: [
      { level: 1, smallBlind: 10, bigBlind: 20, ante: 0, durationMinutes: 5 },
      { level: 2, smallBlind: 15, bigBlind: 30, ante: 0, durationMinutes: 5 },
      { level: 3, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 5 },
      { level: 4, smallBlind: 50, bigBlind: 100, ante: 10, durationMinutes: 5 },
      { level: 5, smallBlind: 75, bigBlind: 150, ante: 15, durationMinutes: 5 },
      { level: 6, smallBlind: 100, bigBlind: 200, ante: 20, durationMinutes: 5 },
      { level: 7, smallBlind: 150, bigBlind: 300, ante: 30, durationMinutes: 5 },
      { level: 8, smallBlind: 200, bigBlind: 400, ante: 40, durationMinutes: 5 },
      { level: 9, smallBlind: 300, bigBlind: 600, ante: 60, durationMinutes: 5 },
      { level: 10, smallBlind: 400, bigBlind: 800, ante: 80, durationMinutes: 5 }
    ]
  },
  standard: {
    name: 'Standard',
    startingChips: 3000,
    levels: [
      { level: 1, smallBlind: 10, bigBlind: 20, ante: 0, durationMinutes: 10 },
      { level: 2, smallBlind: 15, bigBlind: 30, ante: 0, durationMinutes: 10 },
      { level: 3, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 10 },
      { level: 4, smallBlind: 50, bigBlind: 100, ante: 10, durationMinutes: 10 },
      { level: 5, smallBlind: 75, bigBlind: 150, ante: 15, durationMinutes: 10 },
      { level: 6, smallBlind: 100, bigBlind: 200, ante: 20, durationMinutes: 10 },
      { level: 7, smallBlind: 150, bigBlind: 300, ante: 30, durationMinutes: 10 },
      { level: 8, smallBlind: 200, bigBlind: 400, ante: 40, durationMinutes: 10 },
      { level: 9, smallBlind: 300, bigBlind: 600, ante: 60, durationMinutes: 10 },
      { level: 10, smallBlind: 400, bigBlind: 800, ante: 80, durationMinutes: 10 }
    ]
  },
  deep: {
    name: 'Deep Stack',
    startingChips: 5000,
    levels: [
      { level: 1, smallBlind: 10, bigBlind: 20, ante: 0, durationMinutes: 15 },
      { level: 2, smallBlind: 15, bigBlind: 30, ante: 0, durationMinutes: 15 },
      { level: 3, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 15 },
      { level: 4, smallBlind: 50, bigBlind: 100, ante: 10, durationMinutes: 15 },
      { level: 5, smallBlind: 75, bigBlind: 150, ante: 15, durationMinutes: 15 },
      { level: 6, smallBlind: 100, bigBlind: 200, ante: 20, durationMinutes: 15 },
      { level: 7, smallBlind: 150, bigBlind: 300, ante: 30, durationMinutes: 15 },
      { level: 8, smallBlind: 200, bigBlind: 400, ante: 40, durationMinutes: 15 },
      { level: 9, smallBlind: 300, bigBlind: 600, ante: 60, durationMinutes: 15 },
      { level: 10, smallBlind: 400, bigBlind: 800, ante: 80, durationMinutes: 15 }
    ]
  }
};

/**
 * Game mode manager - handles mode-specific rules and blind progression
 */
export class GameModeManager {
  private config: GameModeConfig;
  private levelStartTime: number = 0;

  constructor(config: GameModeConfig) {
    this.config = config;
  }

  /**
   * Get current game type
   */
  getGameType(): GameType {
    return this.config.type;
  }

  /**
   * Check if this is a cash game
   */
  isCashGame(): boolean {
    return this.config.type === 'cash';
  }

  /**
   * Check if this is a tournament
   */
  isTournament(): boolean {
    return this.config.type === 'tournament' || this.config.type === 'sng';
  }

  /**
   * Get current blind level (tournament only)
   * @returns Current blind level or null if not a tournament
   */
  getCurrentLevel(): BlindLevel | null {
    if (!this.isTournament() || !this.config.blindStructure) {
      return null;
    }

    const levelIndex = this.config.currentLevel ?? 0;
    return this.config.blindStructure.levels[levelIndex] ?? null;
  }

  /**
   * Get current small blind
   */
  getSmallBlind(): number {
    const level = this.getCurrentLevel();
    return level?.smallBlind ?? 0;
  }

  /**
   * Get current big blind
   */
  getBigBlind(): number {
    const level = this.getCurrentLevel();
    return level?.bigBlind ?? 0;
  }

  /**
   * Get current ante (tournament only)
   */
  getAnte(): number {
    const level = this.getCurrentLevel();
    return level?.ante ?? 0;
  }

  /**
   * Check if big blind ante is active (when ante > 0 in tournament)
   */
  hasBigBlindAnte(): boolean {
    return this.isTournament() && this.getAnte() > 0;
  }

  /**
   * Advance to next blind level (tournament only)
   * @returns True if level advanced, false if at max level
   */
  advanceLevel(): boolean {
    if (!this.isTournament() || !this.config.blindStructure) {
      return false;
    }

    const currentLevel = this.config.currentLevel ?? 0;
    const maxLevel = this.config.blindStructure.levels.length - 1;

    if (currentLevel < maxLevel) {
      this.config.currentLevel = currentLevel + 1;
      this.levelStartTime = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Set blind level manually (tournament only)
   * @param level Level index (0-based)
   */
  setLevel(level: number): void {
    if (!this.isTournament() || !this.config.blindStructure) {
      return;
    }

    const maxLevel = this.config.blindStructure.levels.length - 1;
    this.config.currentLevel = Math.max(0, Math.min(level, maxLevel));
    this.levelStartTime = Date.now();
  }

  /**
   * Get time remaining in current level (tournament only)
   * @returns Milliseconds remaining, or null if not a tournament
   */
  getTimeRemaining(): number | null {
    if (!this.isTournament() || !this.levelStartTime) {
      return null;
    }

    const level = this.getCurrentLevel();
    if (!level) return null;

    const elapsed = Date.now() - this.levelStartTime;
    const duration = level.durationMinutes * 60 * 1000;
    return Math.max(0, duration - elapsed);
  }

  /**
   * Check if level should advance based on time (tournament only)
   * @returns True if time has expired and level should advance
   */
  shouldAdvanceLevel(): boolean {
    const remaining = this.getTimeRemaining();
    return remaining !== null && remaining <= 0;
  }

  /**
   * Start level timer (tournament only)
   */
  startLevelTimer(): void {
    if (this.isTournament()) {
      this.levelStartTime = Date.now();
    }
  }

  /**
   * Get game mode configuration
   */
  getConfig(): GameModeConfig {
    return { ...this.config };
  }

  /**
   * Update game mode configuration
   */
  updateConfig(config: Partial<GameModeConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

