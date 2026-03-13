// (c) 2025 MiraNova Studios
/**
 * AI configuration and difficulty presets
 */

/**
 * AI configuration parameters
 */
export interface AIConfig {
  aggression: number;    // 0-1: how aggressive (0=passive, 1=very aggressive)
  tightness: number;     // 0-1: how tight (0=loose, 1=tight)
  bluffFrequency: number; // 0-1: how often to bluff
  skill: number;         // 0-1: general skill level
}

/**
 * AI difficulty level
 */
export type AIDifficulty = 'easy' | 'normal' | 'hard' | 'pro';

/**
 * Predefined AI difficulty presets
 */
export const AI_PRESETS: Record<AIDifficulty, AIConfig> = {
  easy: {
    aggression: 0.3,
    tightness: 0.3,
    bluffFrequency: 0.1,
    skill: 0.3
  },
  normal: {
    aggression: 0.5,
    tightness: 0.5,
    bluffFrequency: 0.2,
    skill: 0.5
  },
  hard: {
    aggression: 0.7,
    tightness: 0.6,
    bluffFrequency: 0.25,
    skill: 0.7
  },
  pro: {
    aggression: 0.8,
    tightness: 0.7,
    bluffFrequency: 0.3,
    skill: 0.9
  }
};

/**
 * Get AI configuration by difficulty
 * @param difficulty Difficulty level
 * @returns AI configuration
 */
export function getAIPreset(difficulty: AIDifficulty): AIConfig {
  return { ...AI_PRESETS[difficulty] };
}

/**
 * Create custom AI configuration
 * @param base Base difficulty to start from
 * @param overrides Custom overrides
 * @returns Custom AI configuration
 */
export function createCustomAI(
  base: AIDifficulty = 'normal',
  overrides: Partial<AIConfig> = {}
): AIConfig {
  return { ...AI_PRESETS[base], ...overrides };
}

