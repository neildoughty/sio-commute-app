import { describe, it, expect } from 'vitest';
import { isUKSummerTime, ukHour } from './utils.js';

// 2026 clock changes:
//   BST starts: Sun 29 Mar 2026 at 01:00 UTC
//   GMT returns: Sun 25 Oct 2026 at 01:00 UTC

describe('isUKSummerTime', () => {
  it('is false in January', () => {
    expect(isUKSummerTime(new Date('2026-01-15T12:00:00Z'))).toBe(false);
  });

  it('is true in July', () => {
    expect(isUKSummerTime(new Date('2026-07-15T12:00:00Z'))).toBe(true);
  });

  it('switches on at 01:00 UTC last Sunday of March', () => {
    expect(isUKSummerTime(new Date('2026-03-29T00:59:59Z'))).toBe(false);
    expect(isUKSummerTime(new Date('2026-03-29T01:00:00Z'))).toBe(true);
  });

  it('switches off at 01:00 UTC last Sunday of October', () => {
    expect(isUKSummerTime(new Date('2026-10-25T00:59:59Z'))).toBe(true);
    expect(isUKSummerTime(new Date('2026-10-25T01:00:00Z'))).toBe(false);
  });
});

describe('ukHour', () => {
  it('adds 1 hour during BST', () => {
    expect(ukHour(new Date('2026-07-01T06:10:00Z'))).toBe(7);
  });

  it('keeps UTC during GMT', () => {
    expect(ukHour(new Date('2026-01-01T07:10:00Z'))).toBe(7);
  });

  // Cron correctness: only one of the two morning crons should land in hour 7 UK
  it('summer morning cron (06:10 UTC) lands in UK hour 7', () => {
    expect(ukHour(new Date('2026-07-06T06:10:00Z'))).toBe(7);
  });

  it('winter morning cron (07:10 UTC) lands in UK hour 7', () => {
    expect(ukHour(new Date('2026-01-05T07:10:00Z'))).toBe(7);
  });

  it('winter morning cron (06:10 UTC) is skipped — lands in UK hour 6', () => {
    expect(ukHour(new Date('2026-01-05T06:10:00Z'))).toBe(6);
  });

  it('summer morning cron (07:10 UTC) is skipped — lands in UK hour 8', () => {
    expect(ukHour(new Date('2026-07-06T07:10:00Z'))).toBe(8);
  });

  it('summer evening cron (16:45 UTC) lands in UK hour 17', () => {
    expect(ukHour(new Date('2026-07-06T16:45:00Z'))).toBe(17);
  });

  it('winter evening cron (17:45 UTC) lands in UK hour 17', () => {
    expect(ukHour(new Date('2026-01-05T17:45:00Z'))).toBe(17);
  });
});
