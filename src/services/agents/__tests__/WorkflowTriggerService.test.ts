/**
 * WorkflowTriggerService.test.ts - Comprehensive unit tests
 * 
 * Tests workflow trigger matching, execution, and error handling.
 * Following testing guidelines with vitest and comprehensive coverage.
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ulid } from 'ulid';
import { WorkflowTriggerService, WorkflowTriggerMatch, AgentWorkflowExecutionRequest } from '../WorkflowTriggerService';
import { AgentWorkflowStorage } from '../../external-workflows/storage/AgentWorkflowStorage';
import { N8nService } from '../../external-workflows/N8nService';
import { ZapierService } from '../../external-workflows/ZapierService';
import { WorkflowExecutionError, WorkflowValidationError } from '../../external-workflows/errors/ExternalWorkflowErrors';
import { ExternalWorkflowConfig, WorkflowIdGenerator } from '../../external-workflows/interfaces/ExternalWorkflowInterfaces';

// Mock dependencies
vi.mock('../../external-workflows/storage/AgentWorkflowStorage');
vi.mock('../../external-workflows/N8nService');
vi.mock('../../external-workflows/ZapierService');
vi.mock('../../../lib/logging/winston-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

describe('WorkflowTriggerService', () => {
  let workflowTriggerService: WorkflowTriggerService;
  let mockWorkflowStorage: AgentWorkflowStorage;
  let mockN8nService: N8nService;
  let mockZapierService: ZapierService;

  const mockWorkflowConfig: ExternalWorkflowConfig = {
    id: WorkflowIdGenerator.generate('test_wf'),
    name: 'Test Email Campaign',
    platform: 'n8n',
    workflowIdOrUrl: 'wf_test_123',
    nlpTriggers: [
      'send email campaign',
      'start marketing campaign',
      'launch email blast'
    ],
    description: 'Sends automated email campaign to subscribers',
    parameters: [
      {
        name: 'campaignName',
        type: 'string',
        required: true,
        description: 'Name of the campaign'
      },
      {
        name: 'audience',
        type: 'string',
        required: false,
        description: 'Target audience',
        defaultValue: 'all'
      }
    ],
    createdAt: new Date(),
    executionCount: 0,
    isActive: true,
    tags: ['marketing', 'email'],
    estimatedDurationMs: 30000
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock instances
    mockWorkflowStorage = new AgentWorkflowStorage({} as any, {} as any);
    mockN8nService = new N8nService({} as any);
    mockZapierService = new ZapierService({} as any);

    // Create service instance
    workflowTriggerService = new WorkflowTriggerService(
      mockWorkflowStorage,
      mockN8nService,
      mockZapierService,
      {
        confidenceThresholds: {
          autoExecute: 0.85,
          confirmationRequired: 0.65,
          suggestion: 0.40
        },
        entityExtraction: {
          enabled: true,
          patterns: {
            email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            url: /https?:\/\/[^\s]+/g,
            number: /\b\d+(?:\.\d+)?\b/g
          }
        },
        rateLimiting: {
          enabled: true,
          maxExecutionsPerMinute: 10,
          maxExecutionsPerHour: 100
        }
      }
    );
  });

  describe('processUserMessage', () => {
    it('should return null when no workflow matches', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'Hello, how are you?';
      
      (mockWorkflowStorage.findWorkflowByTrigger as Mock).mockResolvedValue(null);

      // Act
      const result = await workflowTriggerService.processUserMessage(agentId, userMessage);

      // Assert
      expect(result).toBeNull();
      expect(mockWorkflowStorage.findWorkflowByTrigger).toHaveBeenCalledWith(
        agentId,
        userMessage,
        0.40 // suggestion threshold
      );
    });

    it('should return workflow match with high confidence for exact trigger match', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'Please send email campaign for our new product launch';
      
      const mockWorkflowMatch = {
        workflow: mockWorkflowConfig,
        confidence: 0.9,
        matchedTriggers: ['send email campaign'],
        suggestedParams: {}
      };

      (mockWorkflowStorage.findWorkflowByTrigger as Mock).mockResolvedValue(mockWorkflowMatch);

      // Act
      const result = await workflowTriggerService.processUserMessage(agentId, userMessage);

      // Assert
      expect(result).toBeDefined();
      expect(result!.workflow).toEqual(mockWorkflowConfig);
      expect(result!.confidence).toBe(0.9);
      expect(result!.matchType).toBe('exact');
      expect(result!.extractedEntities).toBeDefined();
    });

    it('should extract entities from user message', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'Send campaign to john@example.com with budget 1000';
      
      const mockWorkflowMatch = {
        workflow: mockWorkflowConfig,
        confidence: 0.8,
        matchedTriggers: ['send campaign'],
        suggestedParams: {}
      };

      (mockWorkflowStorage.findWorkflowByTrigger as Mock).mockResolvedValue(mockWorkflowMatch);

      // Act
      const result = await workflowTriggerService.processUserMessage(agentId, userMessage);

      // Assert
      expect(result).toBeDefined();
      expect(result!.extractedEntities).toHaveLength(2);
      expect(result!.extractedEntities[0]).toMatchObject({
        name: 'email',
        value: 'john@example.com',
        type: 'email'
      });
      expect(result!.extractedEntities[1]).toMatchObject({
        name: 'number',
        value: 1000,
        type: 'number'
      });
    });

    it('should handle rate limiting', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'send email campaign';

      // Simulate rate limit exceeded by calling multiple times rapidly
      const promises = Array.from({ length: 15 }, () => 
        workflowTriggerService.processUserMessage(agentId, userMessage)
      );

      // Act
      const results = await Promise.all(promises);

      // Assert
      // Some requests should be rate limited (return null)
      const rateLimitedResults = results.filter(result => result === null);
      expect(rateLimitedResults.length).toBeGreaterThan(0);
    });

    it('should handle storage errors gracefully', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'send email campaign';
      
      (mockWorkflowStorage.findWorkflowByTrigger as Mock).mockRejectedValue(
        new Error('Storage connection failed')
      );

      // Act
      const result = await workflowTriggerService.processUserMessage(agentId, userMessage);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('executeWorkflow', () => {
    it('should execute n8n workflow successfully', async () => {
      // Arrange
      const executionRequest: AgentWorkflowExecutionRequest = {
        requestId: `wf_exec_req_${ulid()}`,
        agentId: 'test-agent-123',
        userId: 'user-456',
        userMessage: 'send email campaign',
        workflow: mockWorkflowConfig,
        parameters: { campaignName: 'Product Launch', audience: 'all' },
        confidence: 0.9,
        requiresConfirmation: false,
        timestamp: new Date()
      };

      const mockExecutionResult = {
        executionId: WorkflowIdGenerator.generate('exec'),
        workflowId: 'wf_test_123',
        status: 'completed' as const,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 5000,
        result: { success: true, emailsSent: 150 },
        logs: [],
        costUsd: 0.05
      };

      // Add small delay to mock to ensure durationMs > 0
      (mockN8nService.executeWorkflow as Mock).mockResolvedValue(mockExecutionResult);

      // Act
      const result = await workflowTriggerService.executeWorkflow(executionRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.requestId).toBe(executionRequest.requestId);
      expect(result.result).toEqual(mockExecutionResult.result);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.costUsd).toBe(0.05);
      expect(mockN8nService.executeWorkflow).toHaveBeenCalledWith({
        workflowId: 'wf_test_123',
        parameters: executionRequest.parameters,
        initiatedBy: {
          type: 'agent',
          id: executionRequest.agentId,
          name: 'Agent workflow trigger'
        },
        sessionId: undefined,
        priority: 'normal',
        timeoutMs: 60000 // 2x estimated duration
      });
    });

    it('should execute zapier workflow successfully', async () => {
      // Arrange
      const zapierWorkflow = { ...mockWorkflowConfig, platform: 'zapier' as const };
      const executionRequest: AgentWorkflowExecutionRequest = {
        requestId: `wf_exec_req_${ulid()}`,
        agentId: 'test-agent-123',
        userMessage: 'send email campaign',
        workflow: zapierWorkflow,
        parameters: { campaignName: 'Product Launch' },
        confidence: 0.9,
        requiresConfirmation: false,
        timestamp: new Date()
      };

      const mockExecutionResult = {
        executionId: WorkflowIdGenerator.generate('exec'),
        workflowId: 'wf_test_123',
        status: 'completed' as const,
        startedAt: new Date(),
        result: { success: true },
        logs: []
      };

      (mockZapierService.executeWorkflow as Mock).mockResolvedValue(mockExecutionResult);

      // Act
      const result = await workflowTriggerService.executeWorkflow(executionRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(mockZapierService.executeWorkflow).toHaveBeenCalled();
    });

    it('should handle workflow execution failure', async () => {
      // Arrange
      const executionRequest: AgentWorkflowExecutionRequest = {
        requestId: `wf_exec_req_${ulid()}`,
        agentId: 'test-agent-123',
        userMessage: 'send email campaign',
        workflow: mockWorkflowConfig,
        parameters: { campaignName: 'Product Launch' },
        confidence: 0.9,
        requiresConfirmation: false,
        timestamp: new Date()
      };

      const mockExecutionResult = {
        executionId: WorkflowIdGenerator.generate('exec'),
        workflowId: 'wf_test_123',
        status: 'failed' as const,
        startedAt: new Date(),
        error: {
          code: 'EXECUTION_FAILED',
          message: 'Workflow execution failed due to invalid parameters'
        },
        logs: []
      };

      (mockN8nService.executeWorkflow as Mock).mockResolvedValue(mockExecutionResult);

      // Act
      const result = await workflowTriggerService.executeWorkflow(executionRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe('Workflow execution failed due to invalid parameters');
    });

    it('should validate required parameters', async () => {
      // Arrange
      const executionRequest: AgentWorkflowExecutionRequest = {
        requestId: `wf_exec_req_${ulid()}`,
        agentId: 'test-agent-123',
        userMessage: 'send email campaign',
        workflow: mockWorkflowConfig,
        parameters: {}, // Missing required 'campaignName' parameter
        confidence: 0.9,
        requiresConfirmation: false,
        timestamp: new Date()
      };

      // Act
      const result = await workflowTriggerService.executeWorkflow(executionRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('WorkflowValidationError');
      expect(result.error!.message).toContain('Required parameter \'campaignName\' is missing');
    });

    it('should handle unsupported platform', async () => {
      // Arrange
      const unsupportedWorkflow = { 
        ...mockWorkflowConfig, 
        platform: 'unsupported' as any 
      };
      const executionRequest: AgentWorkflowExecutionRequest = {
        requestId: `wf_exec_req_${ulid()}`,
        agentId: 'test-agent-123',
        userMessage: 'send email campaign',
        workflow: unsupportedWorkflow,
        parameters: { campaignName: 'Test' },
        confidence: 0.9,
        requiresConfirmation: false,
        timestamp: new Date()
      };

      // Act
      const result = await workflowTriggerService.executeWorkflow(executionRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('No service configured for platform');
    });
  });

  describe('generateWorkflowSuggestion', () => {
    it('should generate suggestion for high confidence match', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'send email campaign';
      const matches: WorkflowTriggerMatch[] = [{
        workflow: mockWorkflowConfig,
        confidence: 0.9,
        matchedTriggers: ['send email campaign'],
        suggestedParams: { campaignName: 'Auto-detected Campaign' },
        extractedEntities: [],
        matchType: 'exact'
      }];

      // Act
      const suggestion = await workflowTriggerService.generateWorkflowSuggestion(
        agentId,
        userMessage,
        matches
      );

      // Assert
      expect(suggestion.agentId).toBe(agentId);
      expect(suggestion.userMessage).toBe(userMessage);
      expect(suggestion.matches).toEqual(matches);
      expect(suggestion.recommendedAction).toBe('execute');
      expect(suggestion.reasoning).toContain('High confidence match (90.0%)');
    });

    it('should generate suggestion for medium confidence match', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'email campaign';
      const matches: WorkflowTriggerMatch[] = [{
        workflow: mockWorkflowConfig,
        confidence: 0.7,
        matchedTriggers: ['email campaign'],
        suggestedParams: {},
        extractedEntities: [],
        matchType: 'fuzzy'
      }];

      // Act
      const suggestion = await workflowTriggerService.generateWorkflowSuggestion(
        agentId,
        userMessage,
        matches
      );

      // Assert
      expect(suggestion.recommendedAction).toBe('confirm');
      expect(suggestion.reasoning).toContain('Medium confidence match (70.0%)');
    });

    it('should generate suggestion for low confidence match', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'campaign';
      const matches: WorkflowTriggerMatch[] = [{
        workflow: mockWorkflowConfig,
        confidence: 0.5,
        matchedTriggers: ['campaign'],
        suggestedParams: {},
        extractedEntities: [],
        matchType: 'fuzzy'
      }];

      // Act
      const suggestion = await workflowTriggerService.generateWorkflowSuggestion(
        agentId,
        userMessage,
        matches
      );

      // Assert
      expect(suggestion.recommendedAction).toBe('clarify');
      expect(suggestion.reasoning).toContain('Low confidence match (50.0%)');
    });

    it('should handle no matches', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'hello world';
      const matches: WorkflowTriggerMatch[] = [];

      // Act
      const suggestion = await workflowTriggerService.generateWorkflowSuggestion(
        agentId,
        userMessage,
        matches
      );

      // Assert
      expect(suggestion.recommendedAction).toBe('ignore');
      expect(suggestion.reasoning).toBe('No workflows match with sufficient confidence');
    });
  });

  describe('entity extraction', () => {
    it('should extract email entities', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'Send email to john@example.com and jane@company.org';
      
      const mockWorkflowMatch = {
        workflow: mockWorkflowConfig,
        confidence: 0.8,
        matchedTriggers: ['send email'],
        suggestedParams: {}
      };

      (mockWorkflowStorage.findWorkflowByTrigger as Mock).mockResolvedValue(mockWorkflowMatch);

      // Act
      const result = await workflowTriggerService.processUserMessage(agentId, userMessage);

      // Assert
      expect(result!.extractedEntities).toHaveLength(2);
      expect(result!.extractedEntities[0].type).toBe('email');
      expect(result!.extractedEntities[0].value).toBe('john@example.com');
      expect(result!.extractedEntities[1].type).toBe('email');
      expect(result!.extractedEntities[1].value).toBe('jane@company.org');
    });

    it('should extract URL entities', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'Process data from https://api.example.com/data';
      
      const mockWorkflowMatch = {
        workflow: mockWorkflowConfig,
        confidence: 0.8,
        matchedTriggers: ['process data'],
        suggestedParams: {}
      };

      (mockWorkflowStorage.findWorkflowByTrigger as Mock).mockResolvedValue(mockWorkflowMatch);

      // Act
      const result = await workflowTriggerService.processUserMessage(agentId, userMessage);

      // Assert
      expect(result!.extractedEntities).toHaveLength(1);
      expect(result!.extractedEntities[0].type).toBe('url');
      expect(result!.extractedEntities[0].value).toBe('https://api.example.com/data');
    });

    it('should extract number entities', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'Set budget to 1500.50 and send to 100 recipients';
      
      const mockWorkflowMatch = {
        workflow: mockWorkflowConfig,
        confidence: 0.8,
        matchedTriggers: ['set budget'],
        suggestedParams: {}
      };

      (mockWorkflowStorage.findWorkflowByTrigger as Mock).mockResolvedValue(mockWorkflowMatch);

      // Act
      const result = await workflowTriggerService.processUserMessage(agentId, userMessage);

      // Assert
      expect(result!.extractedEntities).toHaveLength(2);
      expect(result!.extractedEntities[0].type).toBe('number');
      expect(result!.extractedEntities[0].value).toBe(1500.50);
      expect(result!.extractedEntities[1].type).toBe('number');
      expect(result!.extractedEntities[1].value).toBe(100);
    });
  });

  describe('error handling', () => {
    it('should handle workflow storage errors', async () => {
      // Arrange
      const agentId = 'test-agent-123';
      const userMessage = 'send email campaign';
      
      (mockWorkflowStorage.findWorkflowByTrigger as Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const result = await workflowTriggerService.processUserMessage(agentId, userMessage);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle service execution errors', async () => {
      // Arrange
      const executionRequest: AgentWorkflowExecutionRequest = {
        requestId: `wf_exec_req_${ulid()}`,
        agentId: 'test-agent-123',
        userMessage: 'send email campaign',
        workflow: mockWorkflowConfig,
        parameters: { campaignName: 'Test' },
        confidence: 0.9,
        requiresConfirmation: false,
        timestamp: new Date()
      };

      (mockN8nService.executeWorkflow as Mock).mockRejectedValue(
        new WorkflowExecutionError('wf_test_123', 'Service unavailable')
      );

      // Act
      const result = await workflowTriggerService.executeWorkflow(executionRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toBe('Service unavailable');
    });
  });
}); 