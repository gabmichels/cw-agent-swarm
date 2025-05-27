/**
 * SchedulingAnalyzer.test.ts - Unit tests for SchedulingAnalyzer component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchedulingAnalyzer } from '../SchedulingAnalyzer';
import { 
  SchedulingAnalysisResult, 
  SchedulingAnalysisOptions 
} from '../../interfaces/TaskCreationInterfaces';

describe('SchedulingAnalyzer', () => {
  let schedulingAnalyzer: SchedulingAnalyzer;
  let mockCurrentTime: Date;

  beforeEach(() => {
    schedulingAnalyzer = new SchedulingAnalyzer();
    // Set a consistent mock time for testing: Wednesday, Jan 3, 2024, 10:00 AM
    mockCurrentTime = new Date('2024-01-03T10:00:00');
    vi.setSystemTime(mockCurrentTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('analyzeScheduling', () => {
    describe('absolute time expressions', () => {
      it('should parse specific times like "at 3 PM"', async () => {
        const userInput = "Schedule a meeting at 3 PM";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.scheduledTime).toBeDefined();
        expect(result.scheduledTime?.getHours()).toBe(15); // 3 PM
        expect(result.scheduledTime?.getMinutes()).toBe(0);
        expect(result.confidence).toBe(0.9);
        expect(result.timeReferenceType).toBe('absolute');
        expect(result.originalExpression).toBe('at 3 PM');
        expect(result.isRecurring).toBe(false);
      });

      it('should parse times with AM/PM correctly', async () => {
        const testCases = [
          { input: "at 9 AM", expectedHour: 9 },
          { input: "at 9 PM", expectedHour: 21 },
          { input: "at 12 AM", expectedHour: 0 },
          { input: "at 12 PM", expectedHour: 12 }
        ];

        for (const testCase of testCases) {
          const result = await schedulingAnalyzer.analyzeScheduling(`Meeting ${testCase.input}`);
          expect(result.scheduledTime?.getHours()).toBe(testCase.expectedHour);
        }
      });

      it('should parse times with minutes', async () => {
        const userInput = "Schedule at 2:30 PM";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.scheduledTime?.getHours()).toBe(14);
        expect(result.scheduledTime?.getMinutes()).toBe(30);
      });

      it('should parse date expressions like "12/25"', async () => {
        const userInput = "Schedule for 12/25";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.scheduledTime).toBeDefined();
        expect(result.scheduledTime?.getMonth()).toBe(11); // December (0-indexed)
        expect(result.scheduledTime?.getDate()).toBe(25);
        expect(result.confidence).toBe(0.8);
      });

      it('should parse "by [day]" expressions', async () => {
        const userInput = "Complete this by Friday";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.scheduledTime).toBeDefined();
        expect(result.scheduledTime?.getDay()).toBe(5); // Friday
        expect(result.confidence).toBe(0.7);
      });

      it('should schedule for next day if time has passed today', async () => {
        // Current time is 10 AM, schedule for 9 AM should be tomorrow
        const userInput = "Schedule at 9 AM";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.scheduledTime).toBeDefined();
        expect(result.scheduledTime?.getDate()).toBe(mockCurrentTime.getDate() + 1);
        expect(result.scheduledTime?.getHours()).toBe(9);
      });
    });

    describe('relative time expressions', () => {
      it('should parse "tomorrow"', async () => {
        const userInput = "Schedule this for tomorrow";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.scheduledTime).toBeDefined();
        expect(result.scheduledTime?.getDate()).toBe(mockCurrentTime.getDate() + 1);
        expect(result.scheduledTime?.getHours()).toBe(9); // Default to 9 AM
        expect(result.confidence).toBe(0.9);
        expect(result.timeReferenceType).toBe('relative');
        expect(result.originalExpression).toBe('tomorrow');
      });

      it('should parse "today"', async () => {
        const userInput = "Schedule this for today";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.scheduledTime).toBeDefined();
        expect(result.scheduledTime?.getDate()).toBe(mockCurrentTime.getDate());
        expect(result.scheduledTime?.getHours()).toBe(11); // Next hour
        expect(result.confidence).toBe(0.8);
      });

      it('should parse "tonight"', async () => {
        const userInput = "Schedule this for tonight";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.scheduledTime).toBeDefined();
        expect(result.scheduledTime?.getDate()).toBe(mockCurrentTime.getDate());
        expect(result.scheduledTime?.getHours()).toBe(20); // 8 PM
        expect(result.confidence).toBe(0.8);
      });

      it('should parse "in X hours/days/weeks" expressions', async () => {
        const testCases = [
          { input: "in 2 hours", expectedHours: 12 },
          { input: "in 3 days", expectedDays: 6 },
          { input: "in 1 week", expectedDays: 10 }
        ];

        for (const testCase of testCases) {
          const result = await schedulingAnalyzer.analyzeScheduling(`Schedule ${testCase.input}`);
          expect(result.scheduledTime).toBeDefined();
          expect(result.confidence).toBe(0.9);
          
          if (testCase.expectedHours) {
            expect(result.scheduledTime?.getHours()).toBe(testCase.expectedHours);
          }
          if (testCase.expectedDays) {
            expect(result.scheduledTime?.getDate()).toBe(testCase.expectedDays);
          }
        }
      });

      it('should parse "next [day]" expressions', async () => {
        const userInput = "Schedule for next Monday";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.scheduledTime).toBeDefined();
        expect(result.scheduledTime?.getDay()).toBe(1); // Monday
        expect(result.scheduledTime?.getDate()).toBe(8); // Next Monday from Jan 3
        expect(result.confidence).toBe(0.8);
      });

      it('should parse "next week/month" expressions', async () => {
        const testCases = [
          { input: "next week", expectedDays: 7 },
          { input: "next month", expectedMonths: 1 }
        ];

        for (const testCase of testCases) {
          const result = await schedulingAnalyzer.analyzeScheduling(`Schedule ${testCase.input}`);
          expect(result.scheduledTime).toBeDefined();
          expect(result.confidence).toBe(0.7);
        }
      });

      it('should parse "this [time of day]" expressions', async () => {
        const testCases = [
          { input: "this morning", expectedHour: 9 },
          { input: "this afternoon", expectedHour: 14 },
          { input: "this evening", expectedHour: 18 },
          { input: "this night", expectedHour: 20 }
        ];

        for (const testCase of testCases) {
          const result = await schedulingAnalyzer.analyzeScheduling(`Schedule ${testCase.input}`);
          expect(result.scheduledTime).toBeDefined();
          expect(result.scheduledTime?.getHours()).toBe(testCase.expectedHour);
          expect(result.confidence).toBe(0.7);
        }
      });
    });

    describe('recurring time expressions', () => {
      it('should parse "every [period]" expressions', async () => {
        const testCases = [
          { input: "every day", pattern: "every day" },
          { input: "every week", pattern: "every week" },
          { input: "every month", pattern: "every month" },
          { input: "every year", pattern: "every year" }
        ];

        for (const testCase of testCases) {
          const result = await schedulingAnalyzer.analyzeScheduling(`Schedule ${testCase.input}`);
          expect(result.isRecurring).toBe(true);
          expect(result.recurrencePattern).toBe(testCase.pattern);
          expect(result.confidence).toBe(0.9);
          expect(result.timeReferenceType).toBe('recurring');
        }
      });

      it('should parse frequency words', async () => {
        const testCases = [
          { input: "daily meeting", pattern: "daily" },
          { input: "weekly review", pattern: "weekly" },
          { input: "monthly report", pattern: "monthly" }
        ];

        for (const testCase of testCases) {
          const result = await schedulingAnalyzer.analyzeScheduling(testCase.input);
          expect(result.isRecurring).toBe(true);
          expect(result.recurrencePattern).toBe(testCase.pattern);
          expect(result.confidence).toBe(0.9);
        }
      });

      it('should parse "every [day]" expressions', async () => {
        const userInput = "Schedule every Monday";
        
        const result = await schedulingAnalyzer.analyzeScheduling(userInput);
        
        expect(result.isRecurring).toBe(true);
        expect(result.recurrencePattern).toBe("every monday");
        expect(result.confidence).toBe(0.8);
      });
    });

    it('should return no scheduling info for input without time expressions', async () => {
      const userInput = "Please review the document";
      
      const result = await schedulingAnalyzer.analyzeScheduling(userInput);
      
      expect(result.scheduledTime).toBeUndefined();
      expect(result.confidence).toBe(0);
      expect(result.isRecurring).toBe(false);
    });

    it('should prioritize absolute over relative time expressions', async () => {
      const userInput = "Schedule for tomorrow at 3 PM";
      
      const result = await schedulingAnalyzer.analyzeScheduling(userInput);
      
      expect(result.timeReferenceType).toBe('absolute');
      expect(result.scheduledTime?.getHours()).toBe(15);
    });

    it('should handle options with current time', async () => {
      const customTime = new Date('2024-06-15T14:30:00');
      const options: SchedulingAnalysisOptions = {
        currentTime: customTime
      };
      
      const result = await schedulingAnalyzer.analyzeScheduling("Schedule for tomorrow", options);
      
      expect(result.scheduledTime?.getDate()).toBe(16); // June 16
    });
  });

  describe('parseTimeExpression', () => {
    it('should parse standalone time expressions', async () => {
      const testCases = [
        "tomorrow",
        "at 3 PM",
        "in 2 hours",
        "next Monday"
      ];

      for (const expression of testCases) {
        const result = await schedulingAnalyzer.parseTimeExpression(expression);
        expect(result).toBeInstanceOf(Date);
      }
    });

    it('should return null for invalid time expressions', async () => {
      const invalidExpressions = [
        "hello world",
        "not a time",
        "random text"
      ];

      for (const expression of invalidExpressions) {
        const result = await schedulingAnalyzer.parseTimeExpression(expression);
        expect(result).toBeNull();
      }
    });

    it('should use provided current time', async () => {
      const customTime = new Date('2024-12-25T12:00:00');
      
      const result = await schedulingAnalyzer.parseTimeExpression("tomorrow", customTime);
      
      expect(result?.getDate()).toBe(26); // December 26
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty input', async () => {
      const result = await schedulingAnalyzer.analyzeScheduling("");
      
      expect(result.confidence).toBe(0);
      expect(result.isRecurring).toBe(false);
      expect(result.scheduledTime).toBeUndefined();
    });

    it('should handle malformed time expressions gracefully', async () => {
      const malformedInputs = [
        "at 25 PM", // Invalid hour
        "schedule for 13/45", // Invalid date
        "in -5 hours" // Negative time
      ];

      for (const input of malformedInputs) {
        const result = await schedulingAnalyzer.analyzeScheduling(input);
        // Should not throw errors, may or may not find valid scheduling
        expect(result).toBeDefined();
      }
    });

    it('should handle multiple time expressions in one input', async () => {
      const userInput = "Schedule for tomorrow at 3 PM every week";
      
      const result = await schedulingAnalyzer.analyzeScheduling(userInput);
      
      // Should prioritize absolute time over recurring
      expect(result.timeReferenceType).toBe('absolute');
      expect(result.scheduledTime?.getHours()).toBe(15);
    });

    it('should handle case-insensitive time expressions', async () => {
      const testCases = [
        "TOMORROW",
        "At 3 PM",
        "NEXT MONDAY",
        "EVERY DAY"
      ];

      for (const input of testCases) {
        const result = await schedulingAnalyzer.analyzeScheduling(input);
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('weekday calculations', () => {
    it('should correctly calculate next weekday occurrences', async () => {
      // Current time is Wednesday (day 3)
      const testCases = [
        { day: "Thursday", expectedDate: 4 }, // Tomorrow
        { day: "Friday", expectedDate: 5 }, // Day after tomorrow
        { day: "Monday", expectedDate: 8 }, // Next Monday
        { day: "Wednesday", expectedDate: 10 } // Next Wednesday (not today)
      ];

      for (const testCase of testCases) {
        const result = await schedulingAnalyzer.analyzeScheduling(`Schedule for next ${testCase.day}`);
        expect(result.scheduledTime?.getDate()).toBe(testCase.expectedDate);
      }
    });
  });

  describe('timezone handling', () => {
    it('should accept timezone in options', async () => {
      const options: SchedulingAnalysisOptions = {
        timezone: 'America/New_York'
      };
      
      const result = await schedulingAnalyzer.analyzeScheduling("Schedule for tomorrow", options);
      
      // Should not throw errors and should process normally
      expect(result).toBeDefined();
    });
  });
}); 