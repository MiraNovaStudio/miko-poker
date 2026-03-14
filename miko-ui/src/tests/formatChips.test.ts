/**
 * Tests for formatChips() and SettingsManager chip display logic.
 *
 * SettingsManager uses localStorage, so we mock it for a clean environment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing SettingsManager (it reads on construction)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

// Now import — SettingsManager singleton will init with our mock
import { formatChips, SettingsManager } from '../managers/SettingsManager';

describe('formatChips', () => {
  beforeEach(() => {
    // Reset to dollar mode
    SettingsManager.instance.chipDisplay = 'dollar';
  });

  describe('dollar mode', () => {
    it('should format positive amounts with $ prefix', () => {
      expect(formatChips(100)).toBe('$100');
      expect(formatChips(1000)).toBe('$1000');
      expect(formatChips(1)).toBe('$1');
    });

    it('should format zero', () => {
      expect(formatChips(0)).toBe('$0');
    });

    it('should format negative amounts', () => {
      expect(formatChips(-50)).toBe('$-50');
    });
  });

  describe('BB mode', () => {
    beforeEach(() => {
      SettingsManager.instance.chipDisplay = 'bb';
    });

    it('should format whole BB amounts without decimals', () => {
      expect(formatChips(10)).toBe('1 BB');
      expect(formatChips(100)).toBe('10 BB');
      expect(formatChips(1000)).toBe('100 BB');
    });

    it('should format fractional BB with one decimal', () => {
      expect(formatChips(5)).toBe('0.5 BB');
      expect(formatChips(15)).toBe('1.5 BB');
      expect(formatChips(25)).toBe('2.5 BB');
    });

    it('should format zero', () => {
      expect(formatChips(0)).toBe('0 BB');
    });

    it('should format amounts not evenly divisible by big blind', () => {
      // 7 / 10 = 0.7
      expect(formatChips(7)).toBe('0.7 BB');
      // 33 / 10 = 3.3
      expect(formatChips(33)).toBe('3.3 BB');
    });
  });
});

describe('SettingsManager', () => {
  it('should be a singleton', () => {
    const a = SettingsManager.instance;
    const b = SettingsManager.instance;
    expect(a).toBe(b);
  });

  it('should read chipDisplay from current state', () => {
    // Verify chipDisplay is one of the valid values
    expect(['dollar', 'bb']).toContain(SettingsManager.instance.chipDisplay);
  });

  it('should default to unicode deck type', () => {
    expect(SettingsManager.instance.deckType).toBe('unicode');
  });

  it('should persist chipDisplay changes to localStorage', () => {
    SettingsManager.instance.chipDisplay = 'bb';
    expect(localStorageMock.setItem).toHaveBeenCalledWith('miko_chipDisplay', 'bb');
  });

  it('should fire onChange listeners when a setting changes', () => {
    const cb = vi.fn();
    SettingsManager.instance.onChange(cb);
    SettingsManager.instance.chipDisplay = 'dollar';
    // Force a change (it skips if value is same)
    SettingsManager.instance.chipDisplay = 'bb';
    expect(cb).toHaveBeenCalled();
  });

  it('should not fire onChange when setting same value', () => {
    SettingsManager.instance.chipDisplay = 'dollar';
    const cb = vi.fn();
    SettingsManager.instance.onChange(cb);
    SettingsManager.instance.chipDisplay = 'dollar'; // same value
    expect(cb).not.toHaveBeenCalled();
  });

  it('should default playerName to "Player"', () => {
    expect(SettingsManager.instance.playerName).toBe('Player');
  });

  it('should trim whitespace-only player names to default', () => {
    SettingsManager.instance.playerName = '   ';
    expect(SettingsManager.instance.playerName).toBe('Player');
  });

  it('should default cardAnimations to true', () => {
    expect(SettingsManager.instance.cardAnimations).toBe(true);
  });

  it('should default fourColorDeck to false', () => {
    expect(SettingsManager.instance.fourColorDeck).toBe(false);
  });

  it('should default tableStyle to table1', () => {
    expect(SettingsManager.instance.tableStyle).toBe('table1');
  });
});
