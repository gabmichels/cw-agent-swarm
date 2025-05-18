import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleBasedImportanceCalculator } from '../RuleBasedImportanceCalculator';
import { ImportanceCalculatorService, ImportanceCalculationMode } from '../ImportanceCalculatorService';
import { LLMImportanceCalculator } from '../LLMImportanceCalculator';
import { ImportanceConverter } from '../ImportanceConverter';
import { ImportanceLevel } from '../../../constants/memory';

// Mock LLM service
const mockLLMService = {
  generateStructuredOutput: vi.fn().mockImplementation(async (model, prompt, schema) => {
    // Simple mock implementation that returns predefined responses
    // based on the content in the prompt
    const contentMatch = prompt.match(/CONTENT:\s*"([^"]+)"/);
    const content = contentMatch ? contentMatch[1].toLowerCase() : '';
    
    // Return different importance scores based on content keywords
    if (content.includes('urgent') || content.includes('critical')) {
      return {
        importance_score: 0.95,
        importance_level: 'critical',
        reasoning: 'Contains urgent/critical keywords',
        is_critical: true,
        keywords: ['urgent', 'critical']
      };
    } else if (content.includes('important') || content.includes('budget')) {
      return {
        importance_score: 0.75,
        importance_level: 'high',
        reasoning: 'Contains important financial information',
        is_critical: false,
        keywords: ['important', 'budget']
      };
    } else if (content.includes('consider') || content.includes('note')) {
      return {
        importance_score: 0.5,
        importance_level: 'medium',
        reasoning: 'Contains moderately important information',
        is_critical: false,
        keywords: ['consider', 'note']
      };
    } else {
      return {
        importance_score: 0.2,
        importance_level: 'low',
        reasoning: 'Routine information',
        is_critical: false,
        keywords: []
      };
    }
  })
};

describe('Importance Calculation', () => {
  describe('ImportanceConverter', () => {
    it('should convert score to level correctly', () => {
      expect(ImportanceConverter.scoreToLevel(0.95)).toBe(ImportanceLevel.CRITICAL);
      expect(ImportanceConverter.scoreToLevel(0.75)).toBe(ImportanceLevel.HIGH);
      expect(ImportanceConverter.scoreToLevel(0.5)).toBe(ImportanceLevel.MEDIUM);
      expect(ImportanceConverter.scoreToLevel(0.2)).toBe(ImportanceLevel.LOW);
    });
    
    it('should convert level to score correctly', () => {
      expect(ImportanceConverter.levelToScore(ImportanceLevel.CRITICAL)).toBe(0.95);
      expect(ImportanceConverter.levelToScore(ImportanceLevel.HIGH)).toBe(0.75);
      expect(ImportanceConverter.levelToScore(ImportanceLevel.MEDIUM)).toBe(0.5);
      expect(ImportanceConverter.levelToScore(ImportanceLevel.LOW)).toBe(0.25);
    });
    
    it('should ensure both fields are present', () => {
      // Only score provided
      expect(ImportanceConverter.ensureBothFields({
        importance_score: 0.8
      })).toEqual({
        importance_score: 0.8,
        importance: ImportanceLevel.HIGH
      });
      
      // Only level provided
      expect(ImportanceConverter.ensureBothFields({
        importance: ImportanceLevel.CRITICAL
      })).toEqual({
        importance: ImportanceLevel.CRITICAL,
        importance_score: 0.95
      });
      
      // Both provided - no change
      expect(ImportanceConverter.ensureBothFields({
        importance: ImportanceLevel.MEDIUM,
        importance_score: 0.5
      })).toEqual({
        importance: ImportanceLevel.MEDIUM,
        importance_score: 0.5
      });
    });
  });
  
  describe('RuleBasedImportanceCalculator', () => {
    let calculator: RuleBasedImportanceCalculator;
    
    beforeEach(() => {
      calculator = new RuleBasedImportanceCalculator();
    });
    
    it('should calculate high importance for critical keywords', async () => {
      const result = await calculator.calculateImportance({
        content: 'This is urgent and critical information that requires immediate attention!',
        contentType: 'message'
      });
      
      expect(result.importance_score).toBeGreaterThan(0.6);
      expect(result.importance_level).toBe(ImportanceLevel.HIGH);
      expect(result.is_critical).toBe(false); // Should only be true for 0.9+
      expect(result.keywords).toContain('urgent');
      expect(result.keywords).toContain('critical');
    });
    
    it('should calculate medium importance for standard information', async () => {
      const result = await calculator.calculateImportance({
        content: 'Please note that we should consider this approach for our strategy.',
        contentType: 'message'
      });
      
      expect(result.importance_score).toBeGreaterThanOrEqual(0.3);
      expect(result.importance_score).toBeLessThan(0.6);
      expect(result.importance_level).toBe(ImportanceLevel.MEDIUM);
      expect(result.is_critical).toBe(false);
    });
    
    it('should calculate low importance for trivial information', async () => {
      const result = await calculator.calculateImportance({
        content: 'This is just a minor update, nothing important.',
        contentType: 'message'
      });
      
      expect(result.importance_score).toBeLessThan(0.3);
      expect(result.importance_level).toBe(ImportanceLevel.LOW);
      expect(result.is_critical).toBe(false);
    });
  });
  
  describe('LLMImportanceCalculator', () => {
    let calculator: LLMImportanceCalculator;
    let ruleBasedCalculator: RuleBasedImportanceCalculator;
    
    beforeEach(() => {
      ruleBasedCalculator = new RuleBasedImportanceCalculator();
      calculator = new LLMImportanceCalculator(
        mockLLMService, 
        ruleBasedCalculator,
        { enableCaching: true }
      );
    });
    
    it('should use LLM to calculate critical importance', async () => {
      const result = await calculator.calculateImportance({
        content: 'This is an urgent matter that requires your immediate attention!',
        contentType: 'message'
      });
      
      expect(result.importance_score).toBeGreaterThanOrEqual(0.9);
      expect(result.importance_level).toBe(ImportanceLevel.CRITICAL);
      expect(result.is_critical).toBe(true);
    });
    
    it('should use LLM to calculate high importance for budget information', async () => {
      const result = await calculator.calculateImportance({
        content: 'Our budget for this project is $50,000 which is very important to remember.',
        contentType: 'message'
      });
      
      expect(result.importance_score).toBeGreaterThanOrEqual(0.6);
      expect(result.importance_score).toBeLessThan(0.9);
      expect(result.importance_level).toBe(ImportanceLevel.HIGH);
    });
    
    it('should use caching for repeated requests', async () => {
      // First call should hit the LLM
      await calculator.calculateImportance({
        content: 'Please note this information for later reference.',
        contentType: 'message'
      });
      
      // Second identical call should use cache
      await calculator.calculateImportance({
        content: 'Please note this information for later reference.',
        contentType: 'message'
      });
      
      // LLM should be called only once
      expect(mockLLMService.generateStructuredOutput).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('ImportanceCalculatorService', () => {
    let service: ImportanceCalculatorService;
    
    beforeEach(() => {
      service = new ImportanceCalculatorService(mockLLMService);
    });
    
    it('should use rule-based calculator in RULE_BASED mode', async () => {
      const result = await service.calculateImportance(
        {
          content: 'This is important information.',
          contentType: 'message'
        },
        ImportanceCalculationMode.RULE_BASED
      );
      
      // Should not call LLM
      expect(mockLLMService.generateStructuredOutput).not.toHaveBeenCalled();
      expect(result.importance_level).toBeDefined();
    });
    
    it('should use LLM calculator in LLM mode', async () => {
      const result = await service.calculateImportance(
        {
          content: 'This is important information.',
          contentType: 'message'
        },
        ImportanceCalculationMode.LLM
      );
      
      // Should call LLM
      expect(mockLLMService.generateStructuredOutput).toHaveBeenCalled();
      expect(result.importance_level).toBeDefined();
    });
    
    it('should convert between score and level', () => {
      expect(service.convertScoreToLevel(0.95)).toBe(ImportanceLevel.CRITICAL);
      expect(service.convertLevelToScore(ImportanceLevel.HIGH)).toBe(0.75);
    });
    
    it('should ensure both importance fields are set', () => {
      const result = service.ensureBothImportanceFields<{
        importance?: ImportanceLevel;
        importance_score?: number;
      }>({
        importance_score: 0.8
      });
      
      expect(result.importance).toBe(ImportanceLevel.HIGH);
      expect(result.importance_score).toBe(0.8);
    });
  });
}); 