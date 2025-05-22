/**
 * DateTimeProcessor.test.ts
 * Unit tests for the BasicDateTimeProcessor implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BasicDateTimeProcessor } from '../../src/lib/scheduler/implementations/datetime/BasicDateTimeProcessor';
import { DateTimeProcessor } from '../../src/lib/scheduler/interfaces/DateTimeProcessor.interface';

describe('BasicDateTimeProcessor', () => {
  let processor: DateTimeProcessor;
  let referenceDate: Date;

  beforeEach(() => {
    processor = new BasicDateTimeProcessor();
    // Fixed reference date for predictable testing: January 15, 2023, 10:30:00 AM
    referenceDate = new Date(2023, 0, 15, 10, 30, 0);
  });

  describe('translateVagueTerm', () => {
    it('should translate "urgent" to a high priority with immediate timing', () => {
      const result = processor.translateVagueTerm('urgent', referenceDate);
      expect(result).not.toBeNull();
      expect(result?.priority).toBeGreaterThan(8); // High priority
      // Should be very close to the reference date (within minutes)
      const timeDiff = result?.date ? result.date.getTime() - referenceDate.getTime() : 0;
      expect(timeDiff).toBeLessThan(60 * 60 * 1000); // Within an hour
    });

    it('should translate "soon" to a medium priority with near-term timing', () => {
      const result = processor.translateVagueTerm('soon', referenceDate);
      expect(result).not.toBeNull();
      // Should be within the next few hours or a day
      const timeDiff = result?.date ? result.date.getTime() - referenceDate.getTime() : 0;
      expect(timeDiff).toBeGreaterThan(0);
      expect(timeDiff).toBeLessThan(24 * 60 * 60 * 1000); // Within a day
    });

    it('should return null for non-vague terms', () => {
      const result = processor.translateVagueTerm('tomorrow', referenceDate);
      expect(result).toBeNull();
    });
  });

  describe('parseNaturalLanguage', () => {
    it('should parse "today" correctly', () => {
      const result = processor.parseNaturalLanguage('today', referenceDate);
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2023);
      expect(result?.getMonth()).toBe(0); // January
      expect(result?.getDate()).toBe(15);
      
      // Do not test exact hours/minutes as implementation may set to different values
      // Just ensure it's the same day
      expect(processor.isSameDay(result!, new Date(2023, 0, 15))).toBe(true);
    });

    it('should parse "tomorrow" correctly', () => {
      const result = processor.parseNaturalLanguage('tomorrow', referenceDate);
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2023);
      expect(result?.getMonth()).toBe(0); // January
      expect(result?.getDate()).toBe(16);
      expect(result?.getHours()).toBe(0); // Should be midnight
      expect(result?.getMinutes()).toBe(0);
    });

    it('should parse "day after tomorrow" correctly', () => {
      const result = processor.parseNaturalLanguage('day after tomorrow', referenceDate);
      expect(result).not.toBeNull();
      expect(result?.getDate()).toBe(17);
    });

    it('should parse "next monday" correctly', () => {
      // January 15, 2023 is a Sunday, so next Monday is January 16
      const result = processor.parseNaturalLanguage('next monday', referenceDate);
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2023);
      expect(result?.getMonth()).toBe(0);
      expect(result?.getDate()).toBe(16);
    });

    it('should parse "in 3 days" correctly', () => {
      const result = processor.parseNaturalLanguage('in 3 days', referenceDate);
      expect(result).not.toBeNull();
      expect(result?.getDate()).toBe(18); // 15 + 3 = 18
    });

    it('should parse "next week" correctly', () => {
      const result = processor.parseNaturalLanguage('next week', referenceDate);
      expect(result).not.toBeNull();
      // Should be 7 days later
      const expectedDate = new Date(referenceDate);
      expectedDate.setDate(expectedDate.getDate() + 7);
      expect(result?.getFullYear()).toBe(expectedDate.getFullYear());
      expect(result?.getMonth()).toBe(expectedDate.getMonth());
      expect(result?.getDate()).toBe(expectedDate.getDate());
    });

    it('should parse "end of month" correctly', () => {
      const result = processor.parseNaturalLanguage('end of month', referenceDate);
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2023);
      expect(result?.getMonth()).toBe(0); // January
      expect(result?.getDate()).toBe(31); // Last day of January
    });

    it('should parse "next month" correctly', () => {
      const result = processor.parseNaturalLanguage('next month', referenceDate);
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2023);
      expect(result?.getMonth()).toBe(1); // February
    });
  });

  describe('formatDate', () => {
    it('should format date as ISO by default', () => {
      const formatted = processor.formatDate(referenceDate);
      expect(formatted).toBe(referenceDate.toISOString());
    });

    it('should format date with short format', () => {
      const formatted = processor.formatDate(referenceDate, 'short');
      expect(formatted).toBe('1/15/2023');
    });

    it('should format date with long format', () => {
      const formatted = processor.formatDate(referenceDate, 'long');
      // This might vary by locale, so we're just checking for general structure
      expect(formatted).toContain('January');
      expect(formatted).toContain('2023');
      expect(formatted).toContain('15');
    });
  });

  describe('calculateInterval', () => {
    it('should add days correctly', () => {
      const result = processor.calculateInterval(referenceDate, '3 days');
      expect(result.getDate()).toBe(18); // 15 + 3 = 18
    });

    it('should add weeks correctly', () => {
      const result = processor.calculateInterval(referenceDate, '2 weeks');
      expect(result.getDate()).toBe(29); // 15 + 14 = 29
    });

    it('should add months correctly', () => {
      const result = processor.calculateInterval(referenceDate, '1 month');
      expect(result.getMonth()).toBe(1); // January (0) + 1 = February (1)
      expect(result.getDate()).toBe(15);
    });

    it('should add hours correctly', () => {
      const result = processor.calculateInterval(referenceDate, '5 hours');
      expect(result.getHours()).toBe(15); // 10 + 5 = 15
    });

    it('should handle singular units', () => {
      const result = processor.calculateInterval(referenceDate, '1 day');
      expect(result.getDate()).toBe(16); // 15 + 1 = 16
    });

    it('should throw error for invalid interval format', () => {
      expect(() => {
        processor.calculateInterval(referenceDate, 'invalid');
      }).toThrow();
    });
  });

  describe('hasPassed', () => {
    it('should return true for dates in the past', () => {
      const pastDate = new Date(2023, 0, 14); // One day before reference
      expect(processor.hasPassed(pastDate, referenceDate)).toBe(true);
    });

    it('should return false for dates in the future', () => {
      const futureDate = new Date(2023, 0, 16); // One day after reference
      expect(processor.hasPassed(futureDate, referenceDate)).toBe(false);
    });

    it('should return false for the exact same time', () => {
      const sameDate = new Date(referenceDate);
      expect(processor.hasPassed(sameDate, referenceDate)).toBe(false);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day with different times', () => {
      const date1 = new Date(2023, 0, 15, 10, 30);
      const date2 = new Date(2023, 0, 15, 15, 45);
      expect(processor.isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different days', () => {
      const date1 = new Date(2023, 0, 15);
      const date2 = new Date(2023, 0, 16);
      expect(processor.isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('getHumanReadableInterval', () => {
    it('should format minutes correctly', () => {
      const start = new Date(2023, 0, 15, 10, 0);
      const end = new Date(2023, 0, 15, 10, 30);
      expect(processor.getHumanReadableInterval(start, end)).toBe('30 minutes');
    });

    it('should format hours correctly', () => {
      const start = new Date(2023, 0, 15, 10, 0);
      const end = new Date(2023, 0, 15, 12, 0);
      expect(processor.getHumanReadableInterval(start, end)).toBe('2 hours');
    });

    it('should format hours and minutes correctly', () => {
      const start = new Date(2023, 0, 15, 10, 0);
      const end = new Date(2023, 0, 15, 12, 30);
      expect(processor.getHumanReadableInterval(start, end)).toBe('2 hours and 30 minutes');
    });

    it('should format days correctly', () => {
      const start = new Date(2023, 0, 15);
      const end = new Date(2023, 0, 17);
      expect(processor.getHumanReadableInterval(start, end)).toBe('2 days');
    });

    it('should handle zero time difference', () => {
      const date = new Date(2023, 0, 15);
      expect(processor.getHumanReadableInterval(date, date)).toBe('now');
    });

    it('should handle negative time difference', () => {
      const start = new Date(2023, 0, 15);
      const end = new Date(2023, 0, 14);
      expect(processor.getHumanReadableInterval(start, end)).toBe('1 day ago');
    });
  });
}); 