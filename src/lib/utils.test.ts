/**
 * Unit tests for utility functions in lib/utils.ts
 * Covers formatRuntime, formatRelativeDate, getMoodEmoji
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRuntime, formatRelativeDate, getMoodEmoji } from './utils';

describe('formatRuntime', () => {
  it('returns empty string for null', () => {
    expect(formatRuntime(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatRuntime(undefined)).toBe('');
  });

  it('returns empty string for 0', () => {
    expect(formatRuntime(0)).toBe('');
  });

  it('formats minutes under 60 as just minutes', () => {
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(1)).toBe('1m');
    expect(formatRuntime(59)).toBe('59m');
  });

  it('formats exactly 60 minutes as 1h', () => {
    expect(formatRuntime(60)).toBe('1h');
  });

  it('formats hours with no remainder as just hours', () => {
    expect(formatRuntime(120)).toBe('2h');
    expect(formatRuntime(180)).toBe('3h');
  });

  it('formats hours and minutes together', () => {
    expect(formatRuntime(90)).toBe('1h 30m');
    expect(formatRuntime(95)).toBe('1h 35m');
    expect(formatRuntime(150)).toBe('2h 30m');
  });

  it('handles large runtimes', () => {
    expect(formatRuntime(240)).toBe('4h');
    expect(formatRuntime(245)).toBe('4h 5m');
  });
});

describe('formatRelativeDate', () => {
  const NOW = new Date('2024-06-15T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Tomorrow" for ~24 hours ahead', () => {
    const tomorrow = new Date(NOW + 25 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(tomorrow)).toBe('Tomorrow');
  });

  it('returns "Yesterday" for a time less than 24 hours ago', () => {
    // Math.floor(-20h / 24h) = -1 → "Yesterday"
    const twentyHoursAgo = new Date(NOW - 20 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(twentyHoursAgo)).toBe('Yesterday');
  });

  it('returns "In Xh" for same-day future hours', () => {
    const inTwoHours = new Date(NOW + 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(inTwoHours)).toBe('In 2h');
  });

  it('returns "In Xm" for same-day future minutes', () => {
    const inThirtyMin = new Date(NOW + 30 * 60 * 1000).toISOString();
    expect(formatRelativeDate(inThirtyMin)).toBe('In 30m');
  });

  it('returns "Yesterday" for recent past hours (any negative diff < 24h gives days=-1)', () => {
    // The floor of a small negative fraction is -1, so even 1h ago returns "Yesterday"
    const oneHourAgo = new Date(NOW - 1 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(oneHourAgo)).toBe('Yesterday');
  });

  it('returns "In X days" for future days within a week', () => {
    const inThreeDays = new Date(NOW + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(inThreeDays)).toBe('In 3 days');
  });

  it('returns "X days ago" for past days within a week', () => {
    const threeDaysAgo = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(threeDaysAgo)).toBe('3 days ago');
  });

  it('returns a locale date string for dates beyond a week', () => {
    const farFuture = new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeDate(farFuture);
    // Should be a formatted date, not a relative string
    expect(result).not.toContain('days');
    expect(result).not.toContain('Tomorrow');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getMoodEmoji', () => {
  it('returns correct emoji for known moods', () => {
    expect(getMoodEmoji('action')).toBe('💥');
    expect(getMoodEmoji('comedy')).toBe('😂');
    expect(getMoodEmoji('horror')).toBe('😱');
    expect(getMoodEmoji('romance')).toBe('💕');
    expect(getMoodEmoji('scifi')).toBe('🚀');
    expect(getMoodEmoji('documentary')).toBe('📚');
    expect(getMoodEmoji('fantasy')).toBe('🧙');
    expect(getMoodEmoji('animation')).toBe('🎨');
  });

  it('is case-insensitive', () => {
    expect(getMoodEmoji('ACTION')).toBe('💥');
    expect(getMoodEmoji('Comedy')).toBe('😂');
    expect(getMoodEmoji('HORROR')).toBe('😱');
  });

  it('returns fallback emoji for unknown mood', () => {
    expect(getMoodEmoji('unknown')).toBe('🎬');
    expect(getMoodEmoji('')).toBe('🎬');
    expect(getMoodEmoji('random-mood-xyz')).toBe('🎬');
  });

  it('handles all defined moods without returning the fallback', () => {
    const knownMoods = [
      'action', 'comedy', 'drama', 'horror', 'romance', 'thriller',
      'documentary', 'scifi', 'fantasy', 'animation', 'family', 'music',
      'mystery', 'western', 'war', 'crime', 'relaxing', 'inspiring',
      'intense', 'thoughtful', 'nostalgic', 'uplifting', 'dark',
      'quirky', 'epic', 'emotional', 'fun', 'educational',
    ];
    knownMoods.forEach((mood) => {
      expect(getMoodEmoji(mood)).not.toBe('🎬');
    });
  });
});
