import { expect, describe, it, vi } from 'vitest';
import { PlannedTask, HumanCollaboration } from '../human-collaboration';

describe('HumanCollaboration', () => {
  describe('checkNeedClarification', () => {
    it('should return true when confidence score is less than 0.6', async () => {
      const task: PlannedTask = {
        goal: 'Do something',
        subGoals: [],
        reasoning: 'This is the reasoning',
        status: 'planning',
        confidenceScore: 0.5
      };
      
      const result = await HumanCollaboration.checkNeedClarification(task);
      expect(result).toBe(true);
    });
    
    it('should return false when confidence score is 0.6 or higher', async () => {
      const task: PlannedTask = {
        goal: 'Do something',
        subGoals: [],
        reasoning: 'This is the reasoning',
        status: 'planning',
        confidenceScore: 0.6
      };
      
      const result = await HumanCollaboration.checkNeedClarification(task);
      expect(result).toBe(false);
    });
    
    it('should return true when required params are missing', async () => {
      const task: PlannedTask = {
        goal: 'Do something',
        subGoals: [],
        reasoning: 'This is the reasoning',
        status: 'planning',
        confidenceScore: 0.7,
        requiredParams: ['param1', 'param2'],
        params: { param1: 'value1' } // param2 is missing
      };
      
      const result = await HumanCollaboration.checkNeedClarification(task);
      expect(result).toBe(true);
    });
    
    it('should return false when all required params are present', async () => {
      const task: PlannedTask = {
        goal: 'Do something',
        subGoals: [],
        reasoning: 'This is the reasoning',
        status: 'planning',
        confidenceScore: 0.7,
        requiredParams: ['param1', 'param2'],
        params: { param1: 'value1', param2: 'value2' }
      };
      
      const result = await HumanCollaboration.checkNeedClarification(task);
      expect(result).toBe(false);
    });
    
    it('should return true when task description contains uncertainty words', async () => {
      const task: PlannedTask = {
        goal: 'Maybe do something, I am not sure',
        subGoals: [],
        reasoning: 'This is the reasoning',
        status: 'planning',
        confidenceScore: 0.7
      };
      
      const result = await HumanCollaboration.checkNeedClarification(task);
      expect(result).toBe(true);
    });
    
    it('should return true when task reasoning contains uncertainty words', async () => {
      const task: PlannedTask = {
        goal: 'Do something',
        subGoals: [],
        reasoning: 'I am not sure how to approach this task',
        status: 'planning',
        confidenceScore: 0.7
      };
      
      const result = await HumanCollaboration.checkNeedClarification(task);
      expect(result).toBe(true);
    });
  });
  
  describe('generateClarificationQuestions', () => {
    it('should generate questions for missing parameters', async () => {
      const task: PlannedTask = {
        goal: 'Do something',
        subGoals: [],
        reasoning: 'This is the reasoning',
        status: 'planning',
        requiredParams: ['param1', 'param2'],
        params: {} // both params are missing
      };
      
      const questions = await HumanCollaboration.generateClarificationQuestions(task);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.some(q => q.includes('param1'))).toBe(true);
      expect(questions.some(q => q.includes('param2'))).toBe(true);
    });
    
    it('should generate combined question when more than 2 params are missing', async () => {
      const task: PlannedTask = {
        goal: 'Do something',
        subGoals: [],
        reasoning: 'This is the reasoning',
        status: 'planning',
        requiredParams: ['param1', 'param2', 'param3', 'param4'],
        params: {} // all params are missing
      };
      
      const questions = await HumanCollaboration.generateClarificationQuestions(task);
      expect(questions.length).toBe(3); // 2 individual + 1 combined
      expect(questions.some(q => q.includes('param3') && q.includes('param4'))).toBe(true);
    });
    
    it('should generate questions for uncertainty phrases', async () => {
      const task: PlannedTask = {
        goal: 'Do something',
        subGoals: [],
        reasoning: 'I am not sure how to approach this. Maybe we should try something else.',
        status: 'planning',
        confidenceScore: 0.7
      };
      
      const questions = await HumanCollaboration.generateClarificationQuestions(task);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.some(q => q.includes('not sure') || q.includes('Maybe'))).toBe(true);
    });
    
    it('should limit to 3 questions maximum', async () => {
      const task: PlannedTask = {
        goal: 'Maybe do this somehow. I am not sure about it. Perhaps try this approach?',
        subGoals: [],
        reasoning: 'Could be difficult, might need more information.',
        status: 'planning',
        requiredParams: ['param1', 'param2', 'param3', 'param4', 'param5'],
        params: {} // all params are missing
      };
      
      const questions = await HumanCollaboration.generateClarificationQuestions(task);
      expect(questions.length).toBeLessThanOrEqual(3);
    });
    
    it('should generate a generic question when confidence is low but no specific issues found', async () => {
      const task: PlannedTask = {
        goal: 'Do something',
        subGoals: [],
        reasoning: 'This is the reasoning',
        status: 'planning',
        confidenceScore: 0.5
      };
      
      const questions = await HumanCollaboration.generateClarificationQuestions(task);
      expect(questions.length).toBe(1);
      expect(questions[0]).toContain('not entirely confident');
    });
  });
}); 