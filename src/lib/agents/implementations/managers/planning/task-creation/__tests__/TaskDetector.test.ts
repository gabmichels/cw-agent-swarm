/**
 * TaskDetector.test.ts - Unit tests for TaskDetector component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskDetector } from '../TaskDetector';
import { TaskDetectionResult, TaskIndicator, ExtractedTaskInfo, TaskPriority } from '../../interfaces/TaskCreationInterfaces';

describe('TaskDetector', () => {
  let taskDetector: TaskDetector;

  beforeEach(() => {
    taskDetector = new TaskDetector();
  });

  describe('detectTaskIntent', () => {
    it('should detect explicit task creation requests', async () => {
      const userInput = "Please create a task to review the quarterly report by Friday";
      
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.shouldCreateTask).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.indicators).toContainEqual(
        expect.objectContaining({
          type: 'explicit_request',
          text: expect.stringContaining('create a task')
        })
      );
    });

    it('should detect action verbs indicating tasks', async () => {
      const userInput = "I need to schedule a meeting with the team tomorrow";
      
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.shouldCreateTask).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.indicators).toContainEqual(
        expect.objectContaining({
          type: 'action_verb',
          text: expect.stringContaining('schedule')
        })
      );
    });

    it('should detect time references', async () => {
      const userInput = "Remind me to call John at 3 PM today";
      
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.shouldCreateTask).toBe(true);
      expect(result.indicators).toContainEqual(
        expect.objectContaining({
          type: 'time_reference',
          text: expect.stringContaining('3 PM today')
        })
      );
    });

    it('should detect urgency markers', async () => {
      const userInput = "URGENT: Need to fix the production bug immediately";
      
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.shouldCreateTask).toBe(true);
      expect(result.indicators).toContainEqual(
        expect.objectContaining({
          type: 'urgency_marker',
          text: expect.stringContaining('URGENT')
        })
      );
    });

    it('should not detect tasks in casual conversation', async () => {
      const userInput = "How are you doing today? The weather is nice.";
      
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.shouldCreateTask).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.indicators).toHaveLength(0);
    });

    it('should handle empty or invalid input', async () => {
      const result = await taskDetector.detectTaskIntent("");
      
      expect(result.shouldCreateTask).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.indicators).toHaveLength(0);
    });

    it('should provide reasoning for decisions', async () => {
      const userInput = "Set up a meeting for next week";
      
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning).toContain('action verb');
      expect(result.reasoning).toContain('time reference');
    });

    it('should extract task information when detected', async () => {
      const userInput = "Create a high priority task to review the budget by tomorrow";
      
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.taskInfo).toBeDefined();
      expect(result.taskInfo?.name).toContain('review the budget');
      expect(result.taskInfo?.priority).toBe(TaskPriority.HIGH);
      expect(result.taskInfo?.isUrgent).toBe(false);
    });
  });

  describe('extractTaskInfo', () => {
    it('should extract basic task information', async () => {
      const userInput = "Schedule a team meeting for next Monday at 10 AM";
      
      const taskInfo = await taskDetector.extractTaskInfo(userInput);
      
      expect(taskInfo).toBeDefined();
      expect(taskInfo?.name).toContain('team meeting');
      expect(taskInfo?.description).toContain('Schedule a team meeting');
      expect(taskInfo?.priority).toBe(TaskPriority.NORMAL);
    });

    it('should extract priority information', async () => {
      const userInput = "URGENT: Fix the critical bug in production immediately";
      
      const taskInfo = await taskDetector.extractTaskInfo(userInput);
      
      expect(taskInfo?.priority).toBe(TaskPriority.CRITICAL);
      expect(taskInfo?.isUrgent).toBe(true);
    });

    it('should extract time information', async () => {
      const userInput = "Remind me to call the client at 2 PM tomorrow";
      
      const taskInfo = await taskDetector.extractTaskInfo(userInput);
      
      expect(taskInfo?.scheduledTime).toBeDefined();
      expect(taskInfo?.scheduledTime).toBeInstanceOf(Date);
    });

    it('should extract metadata', async () => {
      const userInput = "Create a task to review the Q4 report with the finance team";
      const context = { userId: 'user123', department: 'finance' };
      
      const taskInfo = await taskDetector.extractTaskInfo(userInput, context);
      
      expect(taskInfo?.metadata).toBeDefined();
      expect(taskInfo?.metadata.department).toBe('finance');
      expect(taskInfo?.metadata.keywords).toContain('Q4 report');
    });

    it('should return null for non-task input', async () => {
      const userInput = "What's the weather like today?";
      
      const taskInfo = await taskDetector.extractTaskInfo(userInput);
      
      expect(taskInfo).toBeNull();
    });

    it('should handle complex task descriptions', async () => {
      const userInput = "Set up a high-priority meeting with the development team to discuss the new feature requirements, schedule it for next Friday at 2 PM in the conference room";
      
      const taskInfo = await taskDetector.extractTaskInfo(userInput);
      
      expect(taskInfo?.name).toContain('meeting with the development team');
      expect(taskInfo?.description).toContain('discuss the new feature requirements');
      expect(taskInfo?.priority).toBe(TaskPriority.HIGH);
      expect(taskInfo?.scheduledTime).toBeDefined();
      expect(taskInfo?.metadata.location).toContain('conference room');
    });
  });

  describe('configuration and patterns', () => {
    it('should recognize various action verbs', async () => {
      const actionVerbs = [
        'schedule', 'create', 'set up', 'arrange', 'plan', 'organize',
        'remind', 'call', 'email', 'send', 'review', 'check', 'fix',
        'update', 'complete', 'finish', 'start', 'begin'
      ];

      for (const verb of actionVerbs) {
        const userInput = `I need to ${verb} something important`;
        const result = await taskDetector.detectTaskIntent(userInput);
        
        expect(result.shouldCreateTask).toBe(true);
        expect(result.indicators.some((i: TaskIndicator) => i.type === 'action_verb')).toBe(true);
      }
    });

    it('should recognize time expressions', async () => {
      const timeExpressions = [
        'tomorrow', 'next week', 'in 2 hours', 'at 3 PM', 'by Friday',
        'this afternoon', 'next Monday', 'in the morning', 'tonight'
      ];

      for (const timeExpr of timeExpressions) {
        const userInput = `Schedule a meeting ${timeExpr}`;
        const result = await taskDetector.detectTaskIntent(userInput);
        
        expect(result.indicators.some((i: TaskIndicator) => i.type === 'time_reference')).toBe(true);
      }
    });

    it('should recognize urgency markers', async () => {
      const urgencyMarkers = [
        'URGENT', 'urgent', 'ASAP', 'immediately', 'critical', 'emergency',
        'high priority', 'important', 'rush', 'quickly'
      ];

      for (const marker of urgencyMarkers) {
        const userInput = `${marker}: Fix the issue`;
        const result = await taskDetector.detectTaskIntent(userInput);
        
        expect(result.indicators.some((i: TaskIndicator) => i.type === 'urgency_marker')).toBe(true);
      }
    });
  });

  describe('confidence scoring', () => {
    it('should have high confidence for explicit requests', async () => {
      const userInput = "Please create a task to review the document";
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should have medium confidence for action verbs with time', async () => {
      const userInput = "Schedule a meeting tomorrow";
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('should have low confidence for ambiguous input', async () => {
      const userInput = "I might need to do something later";
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.confidence).toBeLessThan(0.4);
    });

    it('should combine multiple indicators for higher confidence', async () => {
      const userInput = "URGENT: Create a task to schedule the important meeting for tomorrow at 2 PM";
      const result = await taskDetector.detectTaskIntent(userInput);
      
      expect(result.confidence).toBeGreaterThan(0.95);
      expect(result.indicators).toHaveLength(4); // explicit_request, urgency_marker, action_verb, time_reference
    });
  });
}); 