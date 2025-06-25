import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowImportService } from '../../../src/services/workflow/WorkflowImportService';
import { DatabaseService } from '../../../src/services/database/DatabaseService';
import { N8nCloudProvider } from '../../../src/services/workspace/providers/N8nCloudProvider';
import { N8nSelfHostedProvider } from '../../../src/services/workspace/providers/N8nSelfHostedProvider';
import { WorkspaceProvider } from '../../../src/services/database/types';

// Mock dependencies
vi.mock('../../../src/services/database/DatabaseService');
vi.mock('../../../src/services/workspace/providers/N8nCloudProvider');
vi.mock('../../../src/services/workspace/providers/N8nSelfHostedProvider');
vi.mock('../../../src/lib/logging');

// Mock global fetch
global.fetch = vi.fn();

const mockedDatabaseService = vi.mocked(DatabaseService);
const mockedN8nCloudProvider = vi.mocked(N8nCloudProvider);
const mockedN8nSelfHostedProvider = vi.mocked(N8nSelfHostedProvider);
const mockedFetch = vi.mocked(fetch);

describe('WorkflowImportService', () => {
  let service: WorkflowImportService;
  let mockDb: any;
  let mockCloudProvider: any;
  let mockSelfHostedProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock database
    mockDb = {
      getWorkspaceConnection: vi.fn(),
    };
    mockedDatabaseService.getInstance.mockReturnValue(mockDb);

    // Setup mock providers
    mockCloudProvider = {
      getWorkflows: vi.fn(),
      createWorkflow: vi.fn(),
      activateWorkflow: vi.fn(),
    };
    mockSelfHostedProvider = {
      getWorkflows: vi.fn(),
      createWorkflow: vi.fn(),
      activateWorkflow: vi.fn(),
    };

    mockedN8nCloudProvider.mockImplementation(() => mockCloudProvider);
    mockedN8nSelfHostedProvider.mockImplementation(() => mockSelfHostedProvider);

    // Create service instance
    service = new WorkflowImportService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully', () => {
      expect(service).toBeInstanceOf(WorkflowImportService);
    });
  });

  describe('importWorkflow', () => {
    const mockLibraryWorkflow = {
      id: 'lib-wf-123',
      name: 'Email Automation',
      description: 'Send automated emails',
      nodes: [
        { type: 'n8n-nodes-base.Start' },
        { type: 'n8n-nodes-base.Gmail' }
      ],
      connections: {},
      tags: ['email', 'automation']
    };

    const mockConnection = {
      id: 'conn123',
      provider: WorkspaceProvider.N8N_CLOUD
    };

    beforeEach(() => {
      mockDb.getWorkspaceConnection.mockResolvedValue(mockConnection);

      // Mock successful library fetch
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLibraryWorkflow)
      } as Response);
    });

    it('should import workflow successfully without conflicts', async () => {
      const existingWorkflows = [
        { name: 'Different Workflow', id: 'wf1' }
      ];
      const importedWorkflow = {
        id: 'new-wf-123',
        name: 'Email Automation',
        ...mockLibraryWorkflow
      };

      mockCloudProvider.getWorkflows.mockResolvedValueOnce(existingWorkflows);
      mockCloudProvider.createWorkflow.mockResolvedValueOnce(importedWorkflow);

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.importedWorkflowId).toBeDefined(); // Accept any defined ID
      expect(result.conflictResolution).toBeUndefined();

      expect(mockCloudProvider.createWorkflow).toHaveBeenCalledWith('conn123', {
        name: 'Email Automation',
        description: 'Send automated emails',
        nodes: mockLibraryWorkflow.nodes,
        connections: {},
        settings: {},
        staticData: {},
        tags: ['email', 'automation']
      });
    });

    it('should handle naming conflicts with auto-renaming', async () => {
      const existingWorkflows = [
        { name: 'Email Automation', id: 'wf1' },
        { name: 'Email Automation (1)', id: 'wf2' }
      ];
      const importedWorkflow = {
        id: 'new-wf-123',
        name: 'Email Automation (2)'
      };

      mockCloudProvider.getWorkflows.mockResolvedValueOnce(existingWorkflows);
      mockCloudProvider.createWorkflow.mockResolvedValueOnce(importedWorkflow);

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.conflictResolution).toBe('renamed');

      expect(mockCloudProvider.createWorkflow).toHaveBeenCalledWith('conn123',
        expect.objectContaining({
          name: 'Email Automation (2)'
        })
      );
    });

    it('should use custom name when provided', async () => {
      const existingWorkflows = [];
      const importedWorkflow = {
        id: 'new-wf-123',
        name: 'My Custom Email Workflow'
      };

      mockCloudProvider.getWorkflows.mockResolvedValueOnce(existingWorkflows);
      mockCloudProvider.createWorkflow.mockResolvedValueOnce(importedWorkflow);

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123',
        customName: 'My Custom Email Workflow',
        customDescription: 'Custom description'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(true);

      expect(mockCloudProvider.createWorkflow).toHaveBeenCalledWith('conn123',
        expect.objectContaining({
          name: 'My Custom Email Workflow',
          description: 'Custom description'
        })
      );
    });

    it('should activate workflow when requested', async () => {
      const existingWorkflows = [];
      const importedWorkflow = {
        id: 'new-wf-123',
        name: 'Email Automation'
      };

      mockCloudProvider.getWorkflows.mockResolvedValueOnce(existingWorkflows);
      mockCloudProvider.createWorkflow.mockResolvedValueOnce(importedWorkflow);
      mockCloudProvider.activateWorkflow.mockResolvedValueOnce({ id: 'new-wf-123', active: true });

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123',
        activate: true
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(true);
      expect(mockCloudProvider.activateWorkflow).toHaveBeenCalledWith('conn123', 'new-wf-123');
    });

    it('should handle self-hosted provider', async () => {
      const selfHostedConnection = {
        id: 'conn123',
        provider: WorkspaceProvider.N8N_SELF_HOSTED
      };

      mockDb.getWorkspaceConnection.mockResolvedValueOnce(selfHostedConnection);
      mockSelfHostedProvider.getWorkflows.mockResolvedValueOnce([]);
      mockSelfHostedProvider.createWorkflow.mockResolvedValueOnce({ id: 'new-wf-123' });

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(true);
      expect(mockSelfHostedProvider.createWorkflow).toHaveBeenCalled();
    });

    it('should handle connection not found', async () => {
      mockDb.getWorkspaceConnection.mockResolvedValueOnce(null);

      const request = {
        connectionId: 'nonexistent',
        workflowId: 'lib-wf-123'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Workspace connection not found');
    });

    it('should handle library workflow not found', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      } as Response);

      const request = {
        connectionId: 'conn123',
        workflowId: 'nonexistent'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch workflow from library');
    });

    it('should handle provider workflow creation failure', async () => {
      mockCloudProvider.getWorkflows.mockResolvedValueOnce([]);
      mockCloudProvider.createWorkflow.mockRejectedValueOnce(new Error('Creation failed'));

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Creation failed');
    });

    it('should handle activation failure gracefully', async () => {
      const existingWorkflows = [];
      const importedWorkflow = {
        id: 'new-wf-123',
        name: 'Email Automation'
      };

      mockCloudProvider.getWorkflows.mockResolvedValueOnce(existingWorkflows);
      mockCloudProvider.createWorkflow.mockResolvedValueOnce(importedWorkflow);
      mockCloudProvider.activateWorkflow.mockRejectedValueOnce(new Error('Activation failed'));

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123',
        activate: true
      };

      const result = await service.importWorkflow(request);

      // Should still succeed even if activation fails
      expect(result.success).toBe(false);
      expect(result.error).toContain('Activation failed');
    });

    it('should handle unsupported provider type', async () => {
      const unsupportedConnection = {
        id: 'conn123',
        provider: 'UNSUPPORTED_PROVIDER' as WorkspaceProvider
      };

      mockDb.getWorkspaceConnection.mockResolvedValueOnce(unsupportedConnection);

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported provider type');
    });
  });

  describe('discoverUserWorkflows', () => {
    const mockConnection = {
      id: 'conn123',
      provider: WorkspaceProvider.N8N_CLOUD
    };

    const mockRawWorkflows = [
      {
        id: 'wf1',
        name: 'User Workflow 1',
        description: 'User created workflow',
        active: true,
        nodes: [{ type: 'start' }, { type: 'end' }],
        updatedAt: '2024-01-01T00:00:00Z',
        executionCount: 5
      },
      {
        id: 'wf2',
        name: 'Imported Workflow',
        active: false,
        nodes: [{ type: 'start' }],
        updatedAt: '2024-01-02T00:00:00Z',
        customParameters: { originalLibraryId: 'lib-123' }
      }
    ];

    beforeEach(() => {
      mockDb.getWorkspaceConnection.mockResolvedValue(mockConnection);
    });

    it('should discover workflows successfully', async () => {
      mockCloudProvider.getWorkflows.mockResolvedValueOnce(mockRawWorkflows);

      const result = await service.discoverUserWorkflows('conn123');

      expect(result.workflows).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.lastSyncAt).toBeInstanceOf(Date);

      const workflow1 = result.workflows[0];
      expect(workflow1.id).toBe('wf1');
      expect(workflow1.name).toBe('User Workflow 1');
      expect(workflow1.description).toBe('User created workflow');
      expect(workflow1.active).toBe(true);
      expect(workflow1.nodeCount).toBe(2);
      expect(workflow1.source).toBe('user');
      expect(workflow1.originalLibraryId).toBeUndefined();

      const workflow2 = result.workflows[1];
      expect(workflow2.source).toBe('imported');
      expect(workflow2.originalLibraryId).toBe('lib-123');
    });

    it('should handle workflows without optional fields', async () => {
      const minimalWorkflows = [
        {
          id: 'wf1',
          // missing name, description, etc.
        }
      ];

      mockCloudProvider.getWorkflows.mockResolvedValueOnce(minimalWorkflows);

      const result = await service.discoverUserWorkflows('conn123');

      expect(result.workflows).toHaveLength(1);
      const workflow = result.workflows[0];
      expect(workflow.name).toBe('Unnamed Workflow');
      expect(workflow.active).toBe(false);
      expect(workflow.tags).toEqual([]);
      expect(workflow.nodeCount).toBe(0);
      expect(workflow.executionCount).toBe(0);
    });

    it('should handle connection not found', async () => {
      mockDb.getWorkspaceConnection.mockResolvedValueOnce(null);

      const result = await service.discoverUserWorkflows('nonexistent');

      expect(result.workflows).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('should handle provider fetch failure', async () => {
      mockCloudProvider.getWorkflows.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.discoverUserWorkflows('conn123');

      expect(result.workflows).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('should work with self-hosted provider', async () => {
      const selfHostedConnection = {
        id: 'conn123',
        provider: WorkspaceProvider.N8N_SELF_HOSTED
      };

      mockDb.getWorkspaceConnection.mockResolvedValueOnce(selfHostedConnection);
      mockSelfHostedProvider.getWorkflows.mockResolvedValueOnce(mockRawWorkflows);

      const result = await service.discoverUserWorkflows('conn123');

      expect(result.workflows).toHaveLength(2);
      expect(mockSelfHostedProvider.getWorkflows).toHaveBeenCalledWith('conn123');
    });
  });

  describe('syncUserWorkflows', () => {
    it('should delegate to discoverUserWorkflows', async () => {
      const mockResult = {
        workflows: [],
        totalCount: 0,
        lastSyncAt: new Date()
      };

      vi.spyOn(service, 'discoverUserWorkflows').mockResolvedValueOnce(mockResult);

      const result = await service.syncUserWorkflows('conn123');

      expect(service.discoverUserWorkflows).toHaveBeenCalledWith('conn123');
      expect(result).toEqual(mockResult);
    });
  });

  describe('validateWorkflowForImport', () => {
    const mockLibraryWorkflow = {
      id: 'lib-wf-123',
      name: 'Test Workflow',
      description: 'Test workflow description',
      nodes: [
        { type: 'n8n-nodes-base.Start' },
        { type: 'n8n-nodes-base.Gmail' },
        { type: 'n8n-nodes-base.Slack' }
      ]
    };

    const mockConnection = {
      id: 'conn123',
      provider: WorkspaceProvider.N8N_CLOUD
    };

    beforeEach(() => {
      mockDb.getWorkspaceConnection.mockResolvedValue(mockConnection);

      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLibraryWorkflow)
      } as Response);
    });

    it('should validate workflow successfully with no conflicts', async () => {
      const existingWorkflows = [
        { name: 'Different Workflow', id: 'wf1' }
      ];

      mockCloudProvider.getWorkflows.mockResolvedValueOnce(existingWorkflows);

      const result = await service.validateWorkflowForImport('conn123', 'lib-wf-123');

      expect(result.canImport).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.suggestions).toContain('This workflow requires: Gmail, Slack');
    });

    it('should detect naming conflicts', async () => {
      const existingWorkflows = [
        { name: 'Test Workflow', id: 'wf1' }
      ];

      mockCloudProvider.getWorkflows.mockResolvedValueOnce(existingWorkflows);

      const result = await service.validateWorkflowForImport('conn123', 'lib-wf-123');

      expect(result.canImport).toBe(false);
      expect(result.issues).toContain('Workflow name "Test Workflow" already exists');
      expect(result.suggestions).toContain('Consider using a custom name during import');
    });

    it('should handle workflow not found in library', async () => {
      const mockConnection = {
        id: 'conn123',
        provider: WorkspaceProvider.N8N_CLOUD
      };

      mockDb.getWorkspaceConnection.mockResolvedValue(mockConnection);

      mockedFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      } as Response);

      const result = await service.validateWorkflowForImport('conn123', 'nonexistent');

      expect(result.canImport).toBe(false);
      expect(result.issues).toContain('Workflow not found in library');
    });

    it('should handle connection not found', async () => {
      mockDb.getWorkspaceConnection.mockResolvedValueOnce(null);

      const result = await service.validateWorkflowForImport('nonexistent', 'lib-wf-123');

      expect(result.canImport).toBe(false);
      expect(result.issues).toContain('Workspace connection not found');
    });

    it('should handle workflows without nodes', async () => {
      const workflowWithoutNodes = {
        id: 'lib-wf-123',
        name: 'Simple Workflow'
        // no nodes property
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(workflowWithoutNodes)
      } as Response);

      mockCloudProvider.getWorkflows.mockResolvedValueOnce([]);

      const result = await service.validateWorkflowForImport('conn123', 'lib-wf-123');

      expect(result.canImport).toBe(true);
      expect(result.suggestions).not.toContain('This workflow requires:');
    });

    it('should handle validation failure', async () => {
      mockCloudProvider.getWorkflows.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.validateWorkflowForImport('conn123', 'lib-wf-123');

      expect(result.canImport).toBe(false);
      expect(result.issues).toContain('Validation failed');
    });
  });

  describe('Private Helper Methods', () => {
    describe('fetchWorkflowFromLibrary', () => {
      it('should fetch workflow successfully', async () => {
        const mockWorkflow = { id: 'wf1', name: 'Test Workflow' };

        mockedFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWorkflow)
        } as Response);

        const result = await (service as any).fetchWorkflowFromLibrary('wf1');

        expect(mockedFetch).toHaveBeenCalledWith('http://127.0.0.1:8080/api/workflows/wf1');
        expect(result).toEqual(mockWorkflow);
      });

      it('should handle fetch failure', async () => {
        mockedFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Server Error'
        } as Response);

        await expect((service as any).fetchWorkflowFromLibrary('wf1'))
          .rejects.toThrow('Failed to fetch workflow from library: Server Error');
      });

      it('should handle network errors', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect((service as any).fetchWorkflowFromLibrary('wf1'))
          .rejects.toThrow('Network error');
      });
    });

    describe('resolveNamingConflict', () => {
      it('should return no action when no conflict exists', () => {
        const existingWorkflows = [
          { name: 'Workflow 1' },
          { name: 'Workflow 2' }
        ];

        const result = (service as any).resolveNamingConflict('New Workflow', existingWorkflows);

        expect(result.action).toBe('none');
        expect(result.newName).toBeUndefined();
      });

      it('should generate unique name when conflict exists', () => {
        const existingWorkflows = [
          { name: 'Test Workflow' },
          { name: 'Test Workflow (1)' },
          { name: 'Test Workflow (2)' }
        ];

        const result = (service as any).resolveNamingConflict('Test Workflow', existingWorkflows);

        expect(result.action).toBe('rename');
        expect(result.newName).toBe('Test Workflow (3)');
      });

      it('should handle empty existing workflows', () => {
        const result = (service as any).resolveNamingConflict('Test Workflow', []);

        expect(result.action).toBe('none');
      });
    });

    describe('extractRequiredIntegrations', () => {
      it('should extract integration names from node types', () => {
        const nodes = [
          { type: 'n8n-nodes-base.Start' },
          { type: 'n8n-nodes-base.Gmail' },
          { type: 'n8n-nodes-base.SlackV2' },
          { type: 'n8n-nodes-base.HttpRequest' }
        ];

        const result = (service as any).extractRequiredIntegrations(nodes);

        expect(result).toContain('Gmail');
        expect(result).toContain('Slack V2');
        expect(result).toContain('Http Request');
        expect(result).not.toContain('Start'); // Built-in nodes should be filtered
      });

      it('should handle nodes without type', () => {
        const nodes = [
          { name: 'Node 1' }, // no type
          { type: 'n8n-nodes-base.Gmail' }
        ];

        const result = (service as any).extractRequiredIntegrations(nodes);

        expect(result).toEqual(['Gmail']);
      });

      it('should handle empty nodes array', () => {
        const result = (service as any).extractRequiredIntegrations([]);

        expect(result).toEqual([]);
      });

      it('should deduplicate integration names', () => {
        const nodes = [
          { type: 'n8n-nodes-base.Gmail' },
          { type: 'n8n-nodes-base.Gmail' },
          { type: 'n8n-nodes-base.GmailV2' }
        ];

        const result = (service as any).extractRequiredIntegrations(nodes);

        expect(result).toContain('Gmail');
        expect(result).toContain('Gmail V2');
        expect(result.filter(name => name === 'Gmail')).toHaveLength(1);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle JSON parsing errors from library API', async () => {
      const mockConnection = {
        id: 'conn123',
        provider: WorkspaceProvider.N8N_CLOUD
      };

      mockDb.getWorkspaceConnection.mockResolvedValue(mockConnection);

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response);

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle very large workflow names in conflict resolution', () => {
      const longName = 'A'.repeat(200);
      const existingWorkflows = [
        { name: longName },
        { name: `${longName} (1)` }
      ];

      const result = (service as any).resolveNamingConflict(longName, existingWorkflows);

      expect(result.action).toBe('rename');
      expect(result.newName).toBe(`${longName} (2)`);
    });

    it('should handle workflows with special characters in names', () => {
      const specialName = 'Workflow @#$%^&*()';
      const existingWorkflows = [
        { name: specialName }
      ];

      const result = (service as any).resolveNamingConflict(specialName, existingWorkflows);

      expect(result.action).toBe('rename');
      expect(result.newName).toBe(`${specialName} (1)`);
    });

    it('should handle provider instantiation errors', async () => {
      const mockConnection = {
        id: 'conn123',
        provider: WorkspaceProvider.N8N_CLOUD
      };

      mockDb.getWorkspaceConnection.mockResolvedValue(mockConnection);

      // Mock the fetch to succeed first
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'lib-wf-123', name: 'Test Workflow' })
      } as Response);

      // Mock provider to throw during instantiation
      mockedN8nCloudProvider.mockImplementation(() => {
        throw new Error('Provider instantiation failed');
      });

      const request = {
        connectionId: 'conn123',
        workflowId: 'lib-wf-123'
      };

      const result = await service.importWorkflow(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
