import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QdrantClient } from '@qdrant/js-client-rest';
import { N8nService, N8nServiceConfig } from '../../../src/services/external-workflows/N8nService';
import { ZapierService, ZapierServiceConfig } from '../../../src/services/external-workflows/ZapierService';
import { AgentWorkflowStorage } from '../../../src/services/external-workflows/storage/AgentWorkflowStorage';
import { ExternalWorkflowTool } from '../../../src/agents/shared/tools/external/ExternalWorkflowTool';
import { WorkflowIdGenerator } from '../../../src/services/external-workflows/interfaces/ExternalWorkflowInterfaces';

describe('External Workflow Integration', () => {
  let qdrantClient: QdrantClient;
  let n8nService: N8nService;
  let zapierService: ZapierService;
  let workflowStorage: AgentWorkflowStorage;

  beforeEach(() => {
    // Mock Qdrant client with in-memory storage
    const agentStorage = new Map();

    qdrantClient = {
      upsert: vi.fn().mockImplementation((collection, options) => {
        // Store the agent data in our mock storage
        for (const point of options.points) {
          agentStorage.set(point.id, point.payload);
        }
        return Promise.resolve({ operation_id: 'test-op' });
      }),
      retrieve: vi.fn().mockImplementation((collection, options) => {
        // Retrieve from our mock storage
        const results = [];
        for (const id of options.ids) {
          const payload = agentStorage.get(id);
          if (payload) {
            results.push({ payload });
          }
        }
        return Promise.resolve(results);
      }),
      scroll: vi.fn().mockResolvedValue({ points: [] })
    } as any;

    // Create service configurations
    const n8nConfig: N8nServiceConfig = {
      baseUrl: 'http://localhost:5678',
      apiKey: 'test-n8n-key',
      timeoutMs: 30000,
      retryAttempts: 3,
      retryDelayMs: 1000
    };

    const zapierConfig: ZapierServiceConfig = {
      timeoutMs: 30000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      maxHistoryEntries: 100
    };

    // Initialize services
    n8nService = new N8nService(n8nConfig);
    zapierService = new ZapierService(zapierConfig);
    workflowStorage = new AgentWorkflowStorage(qdrantClient);
  });

  it('should complete full workflow lifecycle: save → trigger → execute', async () => {
    const agentId = 'test-agent-123';
    
    // Step 1: Save workflow to agent
    const workflowConfig = {
      name: 'Email Marketing Campaign',
      platform: 'n8n' as const,
      workflowIdOrUrl: 'wf_marketing_123',
      nlpTriggers: [
        'start email marketing campaign',
        'launch marketing campaign',
        'send marketing emails'
      ],
      description: 'Sends personalized email campaign to segmented audience',
      parameters: [
        {
          name: 'campaignName',
          type: 'string' as const,
          required: true,
          description: 'Name of the marketing campaign'
        },
        {
          name: 'audience',
          type: 'string' as const,
          required: false,
          description: 'Target audience segment',
          defaultValue: 'all'
        }
      ],
      isActive: true,
      tags: ['marketing', 'email', 'automation'],
      estimatedDurationMs: 60000
    };

    const savedWorkflow = await workflowStorage.saveWorkflowToAgent(agentId, workflowConfig);

    // Verify workflow was saved with proper ID structure
    expect(savedWorkflow.id.toString()).toMatch(/^wf_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(savedWorkflow.name).toBe('Email Marketing Campaign');
    expect(savedWorkflow.platform).toBe('n8n');
    expect(savedWorkflow.executionCount).toBe(0);

    // Step 2: Test trigger matching
    const userInput = 'Please start the email marketing campaign for our new product launch';
    const matchResult = await workflowStorage.findWorkflowByTrigger(agentId, userInput);

    expect(matchResult).toBeTruthy();
    expect(matchResult!.workflow.id.toString()).toBe(savedWorkflow.id.toString());
    expect(matchResult!.confidence).toBeGreaterThan(0.6);
    expect(matchResult!.matchedTriggers).toContain('start email marketing campaign');

    // Step 3: Create and test external workflow tool
    const workflowTool = new ExternalWorkflowTool(
      {
        workflowId: savedWorkflow.workflowIdOrUrl,
        platform: savedWorkflow.platform,
        name: savedWorkflow.name,
        description: savedWorkflow.description,
        parameters: savedWorkflow.parameters,
        nlpTriggers: savedWorkflow.nlpTriggers,
        estimatedDurationMs: savedWorkflow.estimatedDurationMs,
        tags: savedWorkflow.tags
      },
      n8nService,
      zapierService
    );

    // Test tool can handle the input
    expect(workflowTool.canHandle(userInput)).toBe(true);
    expect(workflowTool.getMatchConfidence(userInput)).toBeGreaterThan(0.6);

    // Test parameter extraction
    const extractedParams = workflowTool.extractParameters(
      'start email marketing campaign with campaignName: New Product Launch'
    );
    expect(extractedParams).toEqual({
      campaignName: 'New Product Launch',
      audience: 'all' // default value
    });
  });

  it('should generate proper ULID-based workflow IDs', () => {
    // Test ULID generation
    const workflowId1 = WorkflowIdGenerator.generate('wf');
    const workflowId2 = WorkflowIdGenerator.generate('wf');

    // IDs should be different
    expect(workflowId1.id).not.toBe(workflowId2.id);
    
    // Should have correct prefix
    expect(workflowId1.prefix).toBe('wf');
    expect(workflowId1.toString()).toMatch(/^wf_[0-9A-HJKMNP-TV-Z]{26}$/);

    // Should have valid timestamp
    expect(workflowId1.timestamp).toBeInstanceOf(Date);
    expect(workflowId1.timestamp.getTime()).toBeLessThanOrEqual(Date.now());

    // Test parsing
    const parsedId = WorkflowIdGenerator.parse(workflowId1.toString());
    expect(parsedId.id).toBe(workflowId1.id);
    expect(parsedId.prefix).toBe(workflowId1.prefix);
  });
});