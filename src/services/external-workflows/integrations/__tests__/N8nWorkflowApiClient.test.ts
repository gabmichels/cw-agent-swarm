import { describe, it, expect, beforeEach, vi } from 'vitest';
import { N8nWorkflowApiClient } from '../N8nWorkflowApiClient';

// Mock axios properly
vi.mock('axios', () => {
  const mockAxios = {
    get: vi.fn(),
    create: vi.fn()
  };
  mockAxios.create.mockReturnValue(mockAxios);
  
  return {
    default: mockAxios,
    create: mockAxios.create
  };
});

describe('N8nWorkflowApiClient', () => {
  let apiClient: N8nWorkflowApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = new N8nWorkflowApiClient(8001);
  });

  describe('constructor', () => {
    it('should create client with default port', () => {
      const client = new N8nWorkflowApiClient();
      expect(client).toBeDefined();
    });

    it('should create client with custom port', () => {
      const client = new N8nWorkflowApiClient(9000);
      expect(client).toBeDefined();
    });
  });

  describe('basic functionality', () => {
    it('should be instantiable', () => {
      expect(apiClient).toBeDefined();
      expect(apiClient).toBeInstanceOf(N8nWorkflowApiClient);
    });

    it('should have required methods', () => {
      expect(typeof apiClient.searchWorkflows).toBe('function');
      expect(typeof apiClient.getWorkflowDetails).toBe('function');
      expect(typeof apiClient.downloadWorkflowJson).toBe('function');
    });
  });
}); 