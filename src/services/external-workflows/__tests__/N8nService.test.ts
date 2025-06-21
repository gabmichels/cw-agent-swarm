import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import axios from 'axios';
import { N8nService, N8nServiceConfig } from '../N8nService';
import { WorkflowExecutionRequest } from '../interfaces/ExternalWorkflowInterfaces';
import { 
  WorkflowConnectionError, 
  WorkflowExecutionError, 
  WorkflowNotFoundError,
  WorkflowRateLimitError 
} from '../errors/ExternalWorkflowErrors';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('N8nService', () => {
  let n8nService: N8nService;
  let mockAxiosInstance: any;
  let config: N8nServiceConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn()
        }
      }
    };

    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);

    config = {
      baseUrl: 'http://localhost:5678',
      apiKey: 'test-api-key',
      timeoutMs: 30000,
      retryAttempts: 3,
      retryDelayMs: 1000
    };

    n8nService = new N8nService(config);
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.baseUrl,
        timeout: config.timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': config.apiKey
        }
      });
    });

    it('should setup response interceptor for rate limiting', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('should return true when connection is successful', async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      const result = await n8nService.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/rest/active');
    });

    it('should throw WorkflowConnectionError when connection fails', async () => {
      const error = new Error('Connection failed');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(n8nService.testConnection()).rejects.toThrow(WorkflowConnectionError);
    });
  });

  describe('getStatus', () => {
    it('should return healthy status when connected', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ status: 200 }) // testConnection
        .mockResolvedValueOnce({ data: { version: '1.0.0' } }); // version

      const status = await n8nService.getStatus();

      expect(status).toEqual({
        platform: 'n8n',
        isConnected: true,
        lastChecked: expect.any(Date),
        version: '1.0.0',
        health: 'healthy',
        issues: []
      });
    });

    it('should return unhealthy status when connection fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const status = await n8nService.getStatus();

      expect(status).toEqual({
        platform: 'n8n',
        isConnected: false,
        lastChecked: expect.any(Date),
        health: 'unhealthy',
        issues: ['Connection failed']
      });
    });
  });

  describe('executeWorkflow', () => {
    const mockRequest: WorkflowExecutionRequest = {
      workflowId: 'test-workflow-123',
      parameters: { input: 'test data' },
      initiatedBy: {
        type: 'agent',
        id: 'test-agent',
        name: 'Test Agent'
      },
      priority: 'normal'
    };

    it('should successfully execute workflow', async () => {
      const mockExecutionResponse = {
        id: 'exec-123',
        finished: true,
        mode: 'manual',
        startedAt: '2023-01-01T00:00:00Z',
        stoppedAt: '2023-01-01T00:01:00Z',
        workflowId: 'test-workflow-123',
        data: {
          resultData: { output: 'test result' }
        }
      };

      const mockWorkflowResponse = {
        id: 'test-workflow-123',
        name: 'Test Workflow',
        active: true,
        nodes: [],
        connections: {},
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        versionId: 'v1'
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockWorkflowResponse }) // validateParameters
        .mockResolvedValue({ data: mockExecutionResponse }); // waitForCompletion polling

      mockAxiosInstance.post.mockResolvedValue({ data: mockExecutionResponse });

      const result = await n8nService.executeWorkflow(mockRequest);

      expect(result.status).toBe('completed');
      expect(result.workflowId).toBe('test-workflow-123');
      expect(result.result).toEqual({ output: 'test result' });
      expect(result.logs).toHaveLength(2); // start and completion logs
    });

    it('should handle workflow not found error', async () => {
      const error = { response: { status: 404 } };
      mockAxiosInstance.get.mockRejectedValue(error);

      const result = await n8nService.executeWorkflow(mockRequest);

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('EXECUTION_ERROR');
    });

    it('should handle validation errors', async () => {
      const mockWorkflowResponse = {
        id: 'test-workflow-123',
        name: 'Test Workflow',
        active: false, // Inactive workflow
        nodes: [],
        connections: {},
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        versionId: 'v1'
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockWorkflowResponse });

      const result = await n8nService.executeWorkflow(mockRequest);

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('WORKFLOW_VALIDATION_FAILED');
    });
  });

  describe('getExecutionStatus', () => {
    it('should return cached result if available', async () => {
      const executionId = 'test-exec-123';
      
      // First execute a workflow to populate cache
      const mockExecutionResponse = {
        id: 'exec-123',
        finished: true,
        mode: 'manual',
        startedAt: '2023-01-01T00:00:00Z',
        stoppedAt: '2023-01-01T00:01:00Z',
        workflowId: 'test-workflow-123',
        data: { resultData: { output: 'test result' } }
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExecutionResponse });
      mockAxiosInstance.post.mockResolvedValue({ data: mockExecutionResponse });

      const mockRequest: WorkflowExecutionRequest = {
        workflowId: 'test-workflow-123',
        parameters: {},
        initiatedBy: { type: 'agent', id: 'test-agent' },
        priority: 'normal'
      };

      const executionResult = await n8nService.executeWorkflow(mockRequest);
      const statusResult = await n8nService.getExecutionStatus(executionResult.executionId.toString());

      expect(statusResult.status).toBe('completed');
    });

    it('should fetch from N8N API if not cached', async () => {
      const executionId = 'test-exec-123';
      const mockExecutionResponse = {
        id: executionId,
        finished: true,
        mode: 'manual',
        startedAt: '2023-01-01T00:00:00Z',
        stoppedAt: '2023-01-01T00:01:00Z',
        workflowId: 'test-workflow-123',
        data: { resultData: { output: 'test result' } }
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockExecutionResponse });

      const result = await n8nService.getExecutionStatus(executionId);

      expect(result.status).toBe('completed');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/rest/executions/${executionId}`);
    });

    it('should throw WorkflowNotFoundError for 404 response', async () => {
      const executionId = 'test-exec-123';
      const error = { response: { status: 404 } };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(n8nService.getExecutionStatus(executionId)).rejects.toThrow(WorkflowNotFoundError);
    });
  });

  describe('cancelExecution', () => {
    it('should successfully cancel execution', async () => {
      const executionId = 'test-exec-123';
      mockAxiosInstance.post.mockResolvedValue({ status: 200 });

      const result = await n8nService.cancelExecution(executionId);

      expect(result).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(`/rest/executions/${executionId}/stop`);
    });

    it('should return false for non-existent execution', async () => {
      const executionId = 'test-exec-123';
      const error = { response: { status: 404 } };
      mockAxiosInstance.post.mockRejectedValue(error);

      const result = await n8nService.cancelExecution(executionId);

      expect(result).toBe(false);
    });
  });

  describe('validateParameters', () => {
    it('should validate parameters against workflow schema', async () => {
      const workflowId = 'test-workflow-123';
      const parameters = { input: 'test data' };

      const mockWorkflowResponse = {
        id: workflowId,
        name: 'Test Workflow',
        active: true,
        nodes: [],
        connections: {},
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        versionId: 'v1'
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockWorkflowResponse });

      const result = await n8nService.validateParameters(workflowId, parameters);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for inactive workflow', async () => {
      const workflowId = 'test-workflow-123';
      const parameters = { input: 'test data' };

      const mockWorkflowResponse = {
        id: workflowId,
        name: 'Test Workflow',
        active: false,
        nodes: [],
        connections: {},
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        versionId: 'v1'
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockWorkflowResponse });

      const result = await n8nService.validateParameters(workflowId, parameters);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('WORKFLOW_INACTIVE');
    });

    it('should handle workflow not found', async () => {
      const workflowId = 'non-existent-workflow';
      const parameters = { input: 'test data' };

      const error = { response: { status: 404 } };
      mockAxiosInstance.get.mockRejectedValue(error);

      const result = await n8nService.validateParameters(workflowId, parameters);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('WORKFLOW_NOT_FOUND');
    });
  });

  describe('getExecutionHistory', () => {
    it('should return execution history for workflow', async () => {
      const workflowId = 'test-workflow-123';
      const mockExecutions = [
        {
          id: 'exec-1',
          finished: true,
          startedAt: '2023-01-01T00:00:00Z',
          stoppedAt: '2023-01-01T00:01:00Z',
          workflowId,
          data: { resultData: { output: 'result1' } }
        },
        {
          id: 'exec-2',
          finished: true,
          startedAt: '2023-01-01T01:00:00Z',
          stoppedAt: '2023-01-01T01:01:30Z',
          workflowId,
          data: { resultData: { output: 'result2' } }
        }
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: { data: mockExecutions } });

      const history = await n8nService.getExecutionHistory(workflowId);

      expect(history.workflowId).toBe(workflowId);
      expect(history.executions).toHaveLength(2);
      expect(history.totalExecutions).toBe(2);
      expect(history.successRate).toBe(1.0); // Both executions successful
      expect(history.averageDurationMs).toBe(75000); // Average of 60s and 90s
    });
  });
}); 