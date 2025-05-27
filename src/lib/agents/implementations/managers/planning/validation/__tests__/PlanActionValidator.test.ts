/**
 * ActionValidator.test.ts - Unit tests for ActionValidator component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  ActionValidator, 
  ActionValidationError,
  ActionValidatorConfig,
  ActionValidationOptions,
  SafetyConstraint
} from '../ActionValidator';
import { PlanAction } from '../../../../../../../agents/shared/base/managers/PlanningManager.interface';

// Mock the logger
vi.mock('../../../../../../logging/winston-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('ActionValidator', () => {
  let validator: ActionValidator;
  let mockAction: PlanAction;

  beforeEach(() => {
    validator = new ActionValidator();
    
    mockAction = {
      id: 'test-action-1',
      name: 'Test Action',
      description: 'A test action for validation',
      type: 'llm_query',
      parameters: {
        prompt: 'Test prompt',
        maxTokens: 100
      },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should initialize with default configuration', () => {
      const config = validator.getConfig();
      
      expect(config.enableParameterValidation).toBe(true);
      expect(config.enableToolAvailabilityCheck).toBe(true);
      expect(config.enablePreconditionCheck).toBe(true);
      expect(config.enableSafetyValidation).toBe(true);
      expect(config.maxParametersPerAction).toBe(20);
      expect(config.validationTimeoutMs).toBe(10000);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<ActionValidatorConfig> = {
        enableParameterValidation: false,
        maxParametersPerAction: 10,
        validationTimeoutMs: 5000
      };
      
      const customValidator = new ActionValidator(customConfig);
      const config = customValidator.getConfig();
      
      expect(config.enableParameterValidation).toBe(false);
      expect(config.maxParametersPerAction).toBe(10);
      expect(config.validationTimeoutMs).toBe(5000);
    });

    it('should update configuration', () => {
      const newConfig = {
        enableSafetyValidation: false,
        maxParametersPerAction: 15
      };
      
      validator.configure(newConfig);
      const config = validator.getConfig();
      
      expect(config.enableSafetyValidation).toBe(false);
      expect(config.maxParametersPerAction).toBe(15);
    });
  });

  describe('validateAction', () => {
    it('should validate a valid action successfully', async () => {
      const result = await validator.validateAction(mockAction);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.issues).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should store validation history', async () => {
      await validator.validateAction(mockAction);
      
      const history = validator.getValidationHistory(mockAction.id);
      expect(history).toBeDefined();
      expect(history?.isValid).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      const invalidAction = { ...mockAction };
      delete (invalidAction as any).id;
      
      await expect(
        validator.validateAction(invalidAction as any)
      ).rejects.toThrow(ActionValidationError);
    });

    it('should skip validation types when requested', async () => {
      const options: ActionValidationOptions = {
        skipValidation: {
          parameters: true,
          tools: true,
          preconditions: true,
          safety: true
        }
      };
      
      const result = await validator.validateAction(mockAction, options);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('validateParameters', () => {
    it('should validate action with valid parameters', async () => {
      const result = await validator.validateParameters(mockAction);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.5);
    });

         it('should warn about missing parameters', async () => {
       const actionWithoutParams = { ...mockAction };
       (actionWithoutParams as any).parameters = undefined;
      
      const result = await validator.validateParameters(actionWithoutParams);
      
      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('warning');
      expect(result.issues[0].message).toContain('no parameters');
    });

    it('should warn about too many parameters', async () => {
      const actionWithManyParams = { ...mockAction };
      actionWithManyParams.parameters = {};
      
      // Add more parameters than the limit
      for (let i = 0; i < 25; i++) {
        actionWithManyParams.parameters[`param${i}`] = `value${i}`;
      }
      
      const result = await validator.validateParameters(actionWithManyParams);
      
      expect(result.issues.some(issue => issue.message.includes('Too many parameters'))).toBe(true);
    });

    it('should detect null/undefined parameter values', async () => {
      const actionWithNullParam = { ...mockAction };
      actionWithNullParam.parameters = {
        validParam: 'valid',
        nullParam: null,
        undefinedParam: undefined
      };
      
      const result = await validator.validateParameters(actionWithNullParam);
      
      expect(result.isValid).toBe(false); // Null/undefined are errors
      expect(result.issues.filter(issue => issue.severity === 'error')).toHaveLength(2);
    });

    it('should warn about empty string parameters', async () => {
      const actionWithEmptyString = { ...mockAction };
      actionWithEmptyString.parameters = {
        validParam: 'valid',
        emptyParam: '',
        whitespaceParam: '   '
      };
      
      const result = await validator.validateParameters(actionWithEmptyString);
      
      expect(result.isValid).toBe(true); // Warnings, not errors
      expect(result.issues.filter(issue => issue.severity === 'warning')).toHaveLength(2);
    });

    it('should warn about very large parameters', async () => {
      const actionWithLargeParam = { ...mockAction };
      actionWithLargeParam.parameters = {
        largeParam: { data: 'x'.repeat(15000) } // Larger than 10KB limit
      };
      
      const result = await validator.validateParameters(actionWithLargeParam);
      
      expect(result.issues.some(issue => issue.message.includes('very large'))).toBe(true);
    });
  });

  describe('validateToolAvailability', () => {
    it('should validate tool availability when tools are provided', async () => {
      const options: ActionValidationOptions = {
        availableTools: ['llm_query', 'web_search', 'file_read']
      };
      
      const result = await validator.validateToolAvailability(mockAction, options);
      
      expect(result.isValid).toBe(true);
    });

    it('should warn when tool is not in available tools list', async () => {
      const options: ActionValidationOptions = {
        availableTools: ['web_search', 'file_read'] // llm_query not included
      };
      
      const result = await validator.validateToolAvailability(mockAction, options);
      
      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.issues.some(issue => issue.message.includes('not in available tools'))).toBe(true);
    });

    it('should validate tool name format', async () => {
      const actionWithInvalidTool = { ...mockAction };
      actionWithInvalidTool.parameters = {
        tool: 'invalid-tool-name!@#'
      };
      
      const result = await validator.validateToolAvailability(actionWithInvalidTool);
      
      expect(result.issues.some(issue => issue.message.includes('invalid format'))).toBe(true);
    });

         it('should handle actions without tool specification', async () => {
       const actionWithoutTool = { ...mockAction };
       actionWithoutTool.type = '';
       (actionWithoutTool as any).parameters = undefined;
      
      const result = await validator.validateToolAvailability(actionWithoutTool);
      
      expect(result.issues.some(issue => issue.message.includes('should specify a tool'))).toBe(true);
    });
  });

  describe('validatePreconditions', () => {
    it('should validate LLM query action preconditions', async () => {
      const result = await validator.validatePreconditions(mockAction);
      
      expect(result.isValid).toBe(true);
    });

    it('should detect missing prompt for LLM query', async () => {
      const actionWithoutPrompt = { ...mockAction };
      actionWithoutPrompt.parameters = { maxTokens: 100 }; // No prompt
      
      const result = await validator.validatePreconditions(actionWithoutPrompt);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.message.includes('requires a prompt parameter'))).toBe(true);
    });

    it('should validate tool_use action preconditions', async () => {
      const toolUseAction = { ...mockAction };
      toolUseAction.type = 'tool_use';
      toolUseAction.parameters = { input: 'test input' };
      
      const result = await validator.validatePreconditions(toolUseAction);
      
      expect(result.isValid).toBe(true);
    });

    it('should warn about missing input for tool_use', async () => {
      const toolUseAction = { ...mockAction };
      toolUseAction.type = 'tool_use';
      toolUseAction.parameters = {}; // No input
      
      const result = await validator.validatePreconditions(toolUseAction);
      
      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.issues.some(issue => issue.message.includes('should have input parameters'))).toBe(true);
    });

    it('should validate analysis action preconditions', async () => {
      const analysisAction = { ...mockAction };
      analysisAction.type = 'analysis';
      analysisAction.parameters = { data: 'test data' };
      
      const result = await validator.validatePreconditions(analysisAction);
      
      expect(result.isValid).toBe(true);
    });

    it('should detect missing data/source for analysis', async () => {
      const analysisAction = { ...mockAction };
      analysisAction.type = 'analysis';
      analysisAction.parameters = {}; // No data or source
      
      const result = await validator.validatePreconditions(analysisAction);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.message.includes('requires data or source parameter'))).toBe(true);
    });

    it('should validate research action preconditions', async () => {
      const researchAction = { ...mockAction };
      researchAction.type = 'research';
      researchAction.parameters = { query: 'test query' };
      
      const result = await validator.validatePreconditions(researchAction);
      
      expect(result.isValid).toBe(true);
    });

    it('should detect missing query/topic for research', async () => {
      const researchAction = { ...mockAction };
      researchAction.type = 'research';
      researchAction.parameters = {}; // No query or topic
      
      const result = await validator.validatePreconditions(researchAction);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.message.includes('requires query or topic parameter'))).toBe(true);
    });

    it('should validate parameter dependencies', async () => {
      const actionWithFilePath = { ...mockAction };
      actionWithFilePath.parameters = {
        filePath: '/path/to/file.txt',
        operation: 'read'
      };
      
      const result = await validator.validatePreconditions(actionWithFilePath);
      
      expect(result.isValid).toBe(true);
    });

    it('should warn about missing operation for file path', async () => {
      const actionWithFilePath = { ...mockAction };
      actionWithFilePath.parameters = {
        filePath: '/path/to/file.txt'
        // No operation specified
      };
      
      const result = await validator.validatePreconditions(actionWithFilePath);
      
      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.issues.some(issue => issue.message.includes('no operation defined'))).toBe(true);
    });

    it('should warn about missing HTTP method for URL', async () => {
      const actionWithUrl = { ...mockAction };
      actionWithUrl.parameters = {
        url: 'https://example.com'
        // No method specified
      };
      
      const result = await validator.validatePreconditions(actionWithUrl);
      
      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.issues.some(issue => issue.message.includes('no HTTP method defined'))).toBe(true);
    });
  });

  describe('validateSafety', () => {
    it('should validate safe actions', async () => {
      const result = await validator.validateSafety(mockAction);
      
      expect(result.isValid).toBe(true);
    });

    it('should detect dangerous tools', async () => {
      const dangerousAction = { ...mockAction };
      dangerousAction.type = 'rm_command';
      dangerousAction.parameters = { tool: 'rm' };
      
      const result = await validator.validateSafety(dangerousAction);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.message.includes('dangerous tools'))).toBe(true);
    });

    it('should detect sensitive data in parameters', async () => {
      const actionWithSensitiveData = { ...mockAction };
      actionWithSensitiveData.parameters = {
        password: 'secret123',
        apiKey: 'key123'
      };
      
      const result = await validator.validateSafety(actionWithSensitiveData);
      
      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.issues.some(issue => issue.message.includes('sensitive data'))).toBe(true);
    });

    it('should detect excessive resource usage', async () => {
      const resourceIntensiveAction = { ...mockAction };
      resourceIntensiveAction.parameters = {
        maxMemory: 2000000000, // 2GB
        timeout: 7200000 // 2 hours
      };
      
      const result = await validator.validateSafety(resourceIntensiveAction);
      
      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.issues.some(issue => issue.message.includes('excessive resources'))).toBe(true);
    });

    it('should detect admin operations', async () => {
      const adminAction = { ...mockAction };
      adminAction.parameters = {
        command: 'sudo rm -rf /',
        elevated: true
      };
      
      const result = await validator.validateSafety(adminAction);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.message.includes('administrative permissions'))).toBe(true);
    });

    it('should use custom safety constraints', async () => {
      const customConstraint: SafetyConstraint = {
        name: 'No Network Access',
        type: 'parameter',
        rule: 'no_network',
        errorMessage: 'Network access is not allowed',
        severity: 'error'
      };
      
      const options: ActionValidationOptions = {
        safetyConstraints: [customConstraint]
      };
      
      const result = await validator.validateSafety(mockAction, options);
      
      expect(result.isValid).toBe(true); // Custom constraint doesn't apply to this action
    });
  });

  describe('safety constraint management', () => {
    it('should add custom safety constraints', () => {
      const customConstraint: SafetyConstraint = {
        name: 'Test Constraint',
        type: 'parameter',
        rule: 'test_rule',
        errorMessage: 'Test error',
        severity: 'warning'
      };
      
      validator.addSafetyConstraint(customConstraint);
      
      const health = validator.getHealthStatus();
      expect(health.safetyConstraintsCount).toBeGreaterThan(4); // Default + custom
    });

    it('should remove safety constraints', () => {
      const initialHealth = validator.getHealthStatus();
      const initialCount = initialHealth.safetyConstraintsCount;
      
      const removed = validator.removeSafetyConstraint('No Dangerous Tools');
      
      expect(removed).toBe(true);
      
      const finalHealth = validator.getHealthStatus();
      expect(finalHealth.safetyConstraintsCount).toBe(initialCount - 1);
    });

    it('should return false when removing non-existent constraint', () => {
      const removed = validator.removeSafetyConstraint('Non-existent Constraint');
      expect(removed).toBe(false);
    });
  });

  describe('validation history management', () => {
    it('should maintain validation history', async () => {
      await validator.validateAction(mockAction);
      
      const history = validator.getValidationHistory(mockAction.id);
      expect(history).toBeDefined();
      expect(history?.isValid).toBe(true);
    });

    it('should return undefined for non-existent action', () => {
      const history = validator.getValidationHistory('non-existent-action');
      expect(history).toBeUndefined();
    });

    it('should clear validation history', async () => {
      await validator.validateAction(mockAction);
      
      validator.clearValidationHistory();
      
      const history = validator.getValidationHistory(mockAction.id);
      expect(history).toBeUndefined();
    });
  });

  describe('health status', () => {
    it('should return health status', () => {
      const health = validator.getHealthStatus();
      
      expect(health.healthy).toBe(true);
      expect(health.validationHistorySize).toBe(0);
      expect(health.safetyConstraintsCount).toBe(4); // Default constraints
      expect(health.config).toBeDefined();
    });

    it('should update health status after operations', async () => {
      await validator.validateAction(mockAction);
      
      const health = validator.getHealthStatus();
      
      expect(health.validationHistorySize).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle validation timeout gracefully', async () => {
      const timeoutValidator = new ActionValidator({
        validationTimeoutMs: 1 // Very short timeout
      });
      
      // This should complete quickly and not timeout
      const result = await timeoutValidator.validateAction(mockAction);
      expect(result).toBeDefined();
    });

    it('should throw ActionValidationError for invalid actions', async () => {
      const invalidAction = null as any;
      
      await expect(
        validator.validateAction(invalidAction)
      ).rejects.toThrow(ActionValidationError);
    });

    it('should include error details in ActionValidationError', async () => {
      const invalidAction = null as any;
      
      try {
        await validator.validateAction(invalidAction);
      } catch (error) {
        expect(error).toBeInstanceOf(ActionValidationError);
        expect((error as ActionValidationError).code).toBe('VALIDATION_FAILED');
        expect((error as ActionValidationError).validationType).toBe('complete');
        expect((error as ActionValidationError).details).toBeDefined();
      }
    });
  });

  describe('integration scenarios', () => {
    it('should validate complex action with all validation types', async () => {
      const complexAction: PlanAction = {
        id: 'complex-action',
        name: 'Complex Action',
        description: 'A complex action with multiple validation aspects',
        type: 'analysis',
        parameters: {
          data: 'test data',
          tool: 'data_analyzer',
          maxMemory: 500000000, // 500MB - within limits
          timeout: 300000, // 5 minutes - within limits
          filePath: '/data/input.csv',
          operation: 'analyze'
        },
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const options: ActionValidationOptions = {
        availableTools: ['data_analyzer', 'web_search'],
        context: { hasDataAccess: true }
      };
      
      const result = await validator.validateAction(complexAction, options);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it('should handle action with multiple validation issues', async () => {
      const problematicAction: PlanAction = {
        id: 'problematic-action',
        name: 'Problematic Action',
        description: 'An action with multiple issues',
        type: 'analysis',
        parameters: {
          // Missing required data/source for analysis
          password: 'secret123', // Sensitive data
          maxMemory: 3000000000, // 3GB - excessive
          tool: 'invalid-tool!@#' // Invalid format
        },
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const options: ActionValidationOptions = {
        availableTools: ['valid_tool']
      };
      
      const result = await validator.validateAction(problematicAction, options);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(3);
      expect(result.score).toBeLessThan(0.5);
    });
  });
}); 