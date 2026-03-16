/**
 * Tests for player roster data integrity and utility functions.
 */

import { describe, it, expect } from 'vitest';
import { PLAYER_ROSTER, pickNewPlayer } from '../data/player-roster';

describe('PLAYER_ROSTER', () => {
  it('should contain 32+ players', () => {
    expect(PLAYER_ROSTER.length).toBeGreaterThanOrEqual(32);
  });

  it('every entry should have name, playstyle, gender, and config', () => {
    for (const entry of PLAYER_ROSTER) {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
      expect(['passive', 'nit', 'shark', 'maniac']).toContain(entry.playstyle);
      expect(['male', 'female']).toContain(entry.gender);
      expect(entry.config).toBeDefined();
    }
  });

  it('should have no duplicate names', () => {
    const names = PLAYER_ROSTER.map(p => p.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('should have valid AI configs with numeric values', () => {
    for (const entry of PLAYER_ROSTER) {
      const { config } = entry;
      // AI configs should have vpipThreshold and aggression as numbers in [0,1]
      expect(typeof config.vpipThreshold).toBe('number');
      expect(config.vpipThreshold).toBeGreaterThanOrEqual(0);
      expect(config.vpipThreshold).toBeLessThanOrEqual(1);

      expect(typeof config.aggression).toBe('number');
      expect(config.aggression).toBeGreaterThanOrEqual(0);
      expect(config.aggression).toBeLessThanOrEqual(1);
    }
  });

  it('playstyle distribution should be roughly correct', () => {
    const counts = { passive: 0, nit: 0, shark: 0, maniac: 0 };
    for (const entry of PLAYER_ROSTER) {
      counts[entry.playstyle]++;
    }
    // Passive should be the largest group
    expect(counts.passive).toBeGreaterThanOrEqual(9);
    // Maniac should be the smallest group
    expect(counts.maniac).toBeLessThanOrEqual(counts.passive);
    expect(counts.maniac).toBeGreaterThanOrEqual(3);
    // Should have some of each
    expect(counts.nit).toBeGreaterThanOrEqual(5);
    expect(counts.shark).toBeGreaterThanOrEqual(5);
  });

  it('avatarName override should be a non-empty string', () => {
    for (const entry of PLAYER_ROSTER) {
      if (entry.avatarName) {
        expect(entry.avatarName.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('pickNewPlayer', () => {
  it('should return a roster entry when no exclusions', () => {
    const result = pickNewPlayer(new Set());
    expect(result).not.toBeNull();
    expect(typeof result!.name).toBe('string');
  });

  it('should exclude specified names', () => {
    const excludeAll = new Set(PLAYER_ROSTER.map(p => p.name));
    const result = pickNewPlayer(excludeAll);
    expect(result).toBeNull();
  });

  it('should not return an excluded player', () => {
    const exclude = new Set(['TiltedGrandma', 'MaxDegen']);
    // Run multiple times to increase confidence
    for (let i = 0; i < 20; i++) {
      const result = pickNewPlayer(exclude);
      if (result) {
        expect(exclude.has(result.name)).toBe(false);
      }
    }
  });

  it('should return the only available player when all others excluded', () => {
    const allButOne = new Set(PLAYER_ROSTER.slice(1).map(p => p.name));
    const result = pickNewPlayer(allButOne);
    expect(result).not.toBeNull();
    expect(result!.name).toBe(PLAYER_ROSTER[0].name);
  });
});
