/**
 * PriorityAnalyzer.test.ts - Unit tests for PriorityAnalyzer component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriorityAnalyzer } from '../PriorityAnalyzer';
import { 
  PriorityAnalysisResult, 
  PriorityAnalysisOptions, 
  TaskPriority 
} from '../../interfaces/TaskCreationInterfaces';

describe('PriorityAnalyzer', () => {
  let priorityAnalyzer: PriorityAnalyzer;

  beforeEach(() => {
    priorityAnalyzer = new PriorityAnalyzer();
  });

  describe('analyzePriority', () => {
    it('should detect critical priority keywords', async () => {
      const userInput = "This is a critical issue that needs immediate attention";
      
      const result = await priorityAnalyzer.analyzePriority(userInput);
      
      expect(result.priority).toBe(TaskPriority.CRITICAL);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.factors).toHaveLength(1);
      expect(result.factors[0].type).toBe('keyword');
      expect(result.factors[0].description).toContain('critical');
      expect(result.isUrgent).toBe(true);
    });

    it('should detect urgent priority keywords', async () => {
      const userInput = "URGENT: Please handle this task as soon as possible";
      
      const result = await priorityAnalyzer.analyzePriority(userInput);
      
      expect(result.priority).toBe(TaskPriority.HIGHEST);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.factors[0].type).toBe('keyword');
      expect(result.isUrgent).toBe(true);
    });

    it('should detect high priority keywords', async () => {
      const userInput = "This is an important task that needs attention";
      
      const result = await priorityAnalyzer.analyzePriority(userInput);
      
      expect(result.priority).toBe(TaskPriority.HIGH);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.factors[0].type).toBe('keyword');
      expect(result.isUrgent).toBe(false);
    });

    it('should detect low priority keywords', async () => {
      const userInput = "This is a minor task that can be done whenever";
      
      const result = await priorityAnalyzer.analyzePriority(userInput);
      
      expect(result.priority).toBe(TaskPriority.LOW); // "minor" has higher weight than "whenever"
      expect(result.confidence).toBeGreaterThan(0.2);
      expect(result.factors[0].type).toBe('keyword');
      expect(result.isUrgent).toBe(false);
    });

    it('should default to normal priority for neutral input', async () => {
      const userInput = "Please schedule a meeting with the team";
      
      const result = await priorityAnalyzer.analyzePriority(userInput);
      
      expect(result.priority).toBe(TaskPriority.NORMAL);
      expect(result.confidence).toBe(0.5);
      expect(result.isUrgent).toBe(false);
    });

    it('should analyze time constraints for priority adjustment', async () => {
      const userInput = "We need to complete this task today";
      
      const result = await priorityAnalyzer.analyzePriority(userInput);
      
      expect(result.factors.some((f: { type: string }) => f.type === 'time_constraint')).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle multiple priority indicators', async () => {
      const userInput = "URGENT: This critical task must be done now";
      
      const result = await priorityAnalyzer.analyzePriority(userInput);
      
      expect(result.priority).toBe(TaskPriority.CRITICAL);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.isUrgent).toBe(true);
      expect(result.factors.length).toBeGreaterThan(0);
    });

    it('should analyze conversation context when provided', async () => {
      const userInput = "Please handle this task";
      const options: PriorityAnalysisOptions = {
        conversationContext: [
          "We have an urgent deadline approaching",
          "This is critical for the project",
          "The client is waiting for this"
        ]
      };
      
      const result = await priorityAnalyzer.analyzePriority(userInput, options);
      
      expect(result.factors.some((f: { type: string }) => f.type === 'context')).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should apply user priority patterns when provided', async () => {
      const userInput = "Please review the quarterly report";
      const options: PriorityAnalysisOptions = {
        userPriorityPatterns: {
          'quarterly report': TaskPriority.HIGH,
          'daily standup': TaskPriority.LOW
        }
      };
      
      const result = await priorityAnalyzer.analyzePriority(userInput, options);
      
      expect(result.priority).toBe(TaskPriority.HIGH);
      expect(result.factors.some((f: { type: string }) => f.type === 'user_pattern')).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should apply time-based adjustments when enabled', async () => {
      // Mock the current time to be Friday afternoon
      const mockDate = new Date('2024-01-05T15:30:00'); // Friday 3:30 PM
      vi.setSystemTime(mockDate);
      
      const userInput = "Please complete this task";
      const options: PriorityAnalysisOptions = {
        timeBasedAdjustments: true
      };
      
      const result = await priorityAnalyzer.analyzePriority(userInput, options);
      
      expect(result.factors.some((f: { type: string }) => f.type === 'time_constraint')).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      
      vi.useRealTimers();
    });

    it('should handle empty input gracefully', async () => {
      const result = await priorityAnalyzer.analyzePriority("");
      
      expect(result.priority).toBe(TaskPriority.NORMAL);
      expect(result.confidence).toBe(0.5);
      expect(result.factors).toHaveLength(0);
      expect(result.isUrgent).toBe(false);
    });

    it('should prioritize explicit keywords over time constraints', async () => {
      const userInput = "This low priority task needs to be done today";
      
      const result = await priorityAnalyzer.analyzePriority(userInput);
      
      expect(result.priority).toBe(TaskPriority.LOW);
      expect(result.factors.some((f: { type: string }) => f.type === 'keyword')).toBe(true);
    });
  });

  describe('detectUrgency', () => {
    it('should detect urgent keywords', async () => {
      const urgentInputs = [
        "URGENT: Fix this bug",
        "This is critical",
        "Handle this immediately",
        "Emergency situation",
        "ASAP please",
        "Right away!"
      ];

      for (const input of urgentInputs) {
        const result = await priorityAnalyzer.detectUrgency(input);
        expect(result).toBe(true);
      }
    });

    it('should not detect urgency in normal input', async () => {
      const normalInputs = [
        "Please schedule a meeting",
        "Review the document when you can",
        "This can wait until tomorrow",
        "Low priority task"
      ];

      for (const input of normalInputs) {
        const result = await priorityAnalyzer.detectUrgency(input);
        expect(result).toBe(false);
      }
    });

    it('should handle case-insensitive urgency detection', async () => {
      const inputs = [
        "urgent task",
        "URGENT TASK",
        "Urgent Task",
        "uRgEnT tAsK"
      ];

      for (const input of inputs) {
        const result = await priorityAnalyzer.detectUrgency(input);
        expect(result).toBe(true);
      }
    });
  });

  describe('priority keyword recognition', () => {
    it('should recognize various priority levels', async () => {
      const testCases = [
        { input: "emergency meeting", expectedPriority: TaskPriority.CRITICAL },
        { input: "asap review", expectedPriority: TaskPriority.HIGHEST },
        { input: "high-priority task", expectedPriority: TaskPriority.HIGH },
        { input: "rush this please", expectedPriority: TaskPriority.HIGH },
        { input: "normal task", expectedPriority: TaskPriority.NORMAL },
        { input: "low-priority item", expectedPriority: TaskPriority.LOW },
        { input: "minor update", expectedPriority: TaskPriority.LOW },
        { input: "someday maybe", expectedPriority: TaskPriority.LOWEST }
      ];

      for (const testCase of testCases) {
        const result = await priorityAnalyzer.analyzePriority(testCase.input);
        expect(result.priority).toBe(testCase.expectedPriority);
      }
    });

    it('should choose highest priority when multiple keywords present', async () => {
      const userInput = "This minor task is actually critical";
      
      const result = await priorityAnalyzer.analyzePriority(userInput);
      
      expect(result.priority).toBe(TaskPriority.CRITICAL);
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('time-based priority adjustments', () => {
    it('should increase priority for end of business day', async () => {
      // Mock time to 6 PM
      const mockDate = new Date('2024-01-03T18:00:00'); // Wednesday 6 PM
      vi.setSystemTime(mockDate);
      
      const userInput = "Please complete this task";
      const options: PriorityAnalysisOptions = {
        timeBasedAdjustments: true
      };
      
      const result = await priorityAnalyzer.analyzePriority(userInput, options);
      
      const timeConstraintFactor = result.factors.find((f: { type: string }) => f.type === 'time_constraint');
      expect(timeConstraintFactor).toBeDefined();
      expect(timeConstraintFactor?.description).toContain('End of business day');
      
      vi.useRealTimers();
    });

    it('should not apply time adjustments when disabled', async () => {
      const userInput = "Please complete this task";
      const options: PriorityAnalysisOptions = {
        timeBasedAdjustments: false
      };
      
      const result = await priorityAnalyzer.analyzePriority(userInput, options);
      
      const timeConstraintFactors = result.factors.filter((f: { type: string }) => f.type === 'time_constraint');
      expect(timeConstraintFactors).toHaveLength(0);
    });
  });

  describe('context analysis', () => {
    it('should detect priority indicators in conversation context', async () => {
      const userInput = "Handle this task";
      const options: PriorityAnalysisOptions = {
        conversationContext: [
          "We have a critical deadline",
          "This is urgent for the client",
          "Please prioritize this"
        ]
      };
      
      const result = await priorityAnalyzer.analyzePriority(userInput, options);
      
      const contextFactor = result.factors.find((f: { type: string }) => f.type === 'context');
      expect(contextFactor).toBeDefined();
      expect(contextFactor?.description).toContain('critical');
      expect(contextFactor?.description).toContain('urgent');
    });

    it('should handle empty conversation context', async () => {
      const userInput = "Handle this task";
      const options: PriorityAnalysisOptions = {
        conversationContext: []
      };
      
      const result = await priorityAnalyzer.analyzePriority(userInput, options);
      
      const contextFactors = result.factors.filter((f: { type: string }) => f.type === 'context');
      expect(contextFactors).toHaveLength(0);
    });
  });
}); 