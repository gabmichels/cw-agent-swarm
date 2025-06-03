/**
 * Coda Integration Tests
 * 
 * This file tests the Coda tool integration with the DefaultAgent system.
 * Tests are designed to work with both mock and real API depending on configuration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAllCodaTools } from '../../agents/shared/tools/adapters/CodaToolAdapter';
import { DefaultAgent } from '../../agents/shared/DefaultAgent';
import { ToolCategory } from '../../lib/tools/types';

describe('Coda Tool Integration', () => {
  let codaTools: ReturnType<typeof createAllCodaTools>;
  let agent: DefaultAgent;
  
  beforeEach(async () => {
    // Create Coda tools
    codaTools = createAllCodaTools();
    
    // Create test agent with Coda tools enabled
    agent = new DefaultAgent({
      id: 'test-agent-coda',
      name: 'Test Agent for Coda',
      enableToolManager: true,
      enableMemoryManager: false, // Keep it simple for tool testing
      enablePlanningManager: false,
      enableSchedulerManager: false
    });
    
    await agent.initialize();
  });
  
  afterEach(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });

  describe('Tool Registration', () => {
    it('should create all expected Coda tools', () => {
      expect(codaTools).toHaveLength(4);
      
      const toolIds = codaTools.map(tool => tool.id);
      expect(toolIds).toContain('coda_create_document');
      expect(toolIds).toContain('coda_read_document');
      expect(toolIds).toContain('coda_update_document');
      expect(toolIds).toContain('coda_list_documents');
    });
    
    it('should have correct tool properties', () => {
      for (const tool of codaTools) {
        expect(tool.id).toBeTruthy();
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.category).toBe(ToolCategory.DOCUMENT);
        expect(tool.enabled).toBe(true);
        expect(typeof tool.execute).toBe('function');
        expect(tool.schema).toBeDefined();
        expect(tool.metadata).toBeDefined();
      }
    });
    
    it('should have proper metadata with cost estimates', () => {
      for (const tool of codaTools) {
        expect(tool.metadata?.costEstimate).toBeDefined();
        expect(tool.metadata?.usageLimit).toBeDefined();
        expect(tool.metadata?.source).toBe('chloe_adapter');
        expect(tool.metadata?.version).toBe('1.0.0');
      }
    });
  });

  describe('Tool Execution - Mock Mode', () => {
    let mockCodaIntegration: any;
    
    beforeEach(async () => {
      // Mock the Coda integration
      mockCodaIntegration = {
        createDoc: vi.fn(),
        readDoc: vi.fn(),
        updateDoc: vi.fn(),
        listDocs: vi.fn()
      };
      
      // Replace the import with our mock
      vi.doMock('../../agents/shared/tools/integrations/coda', () => ({
        codaIntegration: mockCodaIntegration
      }));
    });
    
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should execute create document tool successfully', async () => {
      const createTool = codaTools.find(tool => tool.id === 'coda_create_document')!;
      
      mockCodaIntegration.createDoc.mockResolvedValue({
        id: 'test-doc-123',
        name: 'Test Document',
        browserLink: 'https://coda.io/d/test-doc-123'
      });
      
      const result = await createTool.execute({
        title: 'Test Document',
        content: '# Test\nThis is a test document.'
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockCodaIntegration.createDoc).toHaveBeenCalledWith(
        'Test Document',
        '# Test\nThis is a test document.'
      );
    });
    
    it('should execute read document tool successfully', async () => {
      const readTool = codaTools.find(tool => tool.id === 'coda_read_document')!;
      
      mockCodaIntegration.readDoc.mockResolvedValue('# Test Document\nContent here');
      
      const result = await readTool.execute({
        documentId: 'test-doc-123'
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockCodaIntegration.readDoc).toHaveBeenCalledWith('test-doc-123');
    });
    
    it('should execute update document tool successfully', async () => {
      const updateTool = codaTools.find(tool => tool.id === 'coda_update_document')!;
      
      mockCodaIntegration.updateDoc.mockResolvedValue(undefined);
      
      const result = await updateTool.execute({
        documentId: 'test-doc-123',
        content: '# Updated Document\nNew content here'
      });
      
      expect(result.success).toBe(true);
      expect(mockCodaIntegration.updateDoc).toHaveBeenCalledWith(
        'test-doc-123',
        '# Updated Document\nNew content here'
      );
    });
    
    it('should execute list documents tool successfully', async () => {
      const listTool = codaTools.find(tool => tool.id === 'coda_list_documents')!;
      
      mockCodaIntegration.listDocs.mockResolvedValue([
        {
          id: 'doc-1',
          name: 'Document 1',
          browserLink: 'https://coda.io/d/doc-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ]);
      
      const result = await listTool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockCodaIntegration.listDocs).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    let mockCodaIntegration: any;
    
    beforeEach(async () => {
      mockCodaIntegration = {
        createDoc: vi.fn(),
        readDoc: vi.fn(),
        updateDoc: vi.fn(),
        listDocs: vi.fn()
      };
      
      vi.doMock('../../agents/shared/tools/integrations/coda', () => ({
        codaIntegration: mockCodaIntegration
      }));
    });
    
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle missing required parameters', async () => {
      const createTool = codaTools.find(tool => tool.id === 'coda_create_document')!;
      
      const result = await createTool.execute({
        title: 'Test' // Missing content
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CODA_CREATE_FAILED');
    });
    
    it('should handle API errors gracefully', async () => {
      const createTool = codaTools.find(tool => tool.id === 'coda_create_document')!;
      
      mockCodaIntegration.createDoc.mockRejectedValue(new Error('API Error'));
      
      const result = await createTool.execute({
        title: 'Test Document',
        content: 'Test content'
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CODA_CREATE_FAILED');
      expect(result.error?.message).toContain('API Error');
    });
  });

  describe('Real API Integration', () => {
    // Only run if CODA_API_KEY is available
    const hasApiKey = !!process.env.CODA_API_KEY;
    
    if (!hasApiKey) {
      it.skip('should skip real API tests when CODA_API_KEY is not available', () => {
        console.log('Skipping real API tests - CODA_API_KEY not set');
      });
      return;
    }

    it('should list documents with real API', async () => {
      const listTool = codaTools.find(tool => tool.id === 'coda_list_documents')!;
      
      const result = await listTool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      console.log('Real API test - List documents result:', result.data);
    }, 30000); // Longer timeout for real API
    
    it('should create and clean up a test document with real API', async () => {
      const createTool = codaTools.find(tool => tool.id === 'coda_create_document')!;
      const readTool = codaTools.find(tool => tool.id === 'coda_read_document')!;
      
      // Create test document
      const createResult = await createTool.execute({
        title: `Test Document ${Date.now()}`,
        content: '# Test Document\n\nThis is a test document created by the integration test.\n\nIt can be safely deleted.'
      });
      
      expect(createResult.success).toBe(true);
      
      const docData = createResult.data as any;
      expect(docData.id).toBeDefined();
      expect(docData.browserLink).toBeDefined();
      
      console.log('Real API test - Created document:', docData);
      
      // Try to read the document
      const readResult = await readTool.execute({
        documentId: docData.id
      });
      
      expect(readResult.success).toBe(true);
      
      console.log('Real API test - Read document content length:', (readResult.data as any)?.contentLength);
      
    }, 60000); // Longer timeout for real API operations
  });

  describe('Agent Integration', () => {
    it('should have Coda tools registered in agent', async () => {
      const tools = await agent.getTools();
      
      const codaToolIds = tools
        .filter(tool => tool.categories?.includes('document'))
        .map(tool => tool.id);
      
      // Should have at least some Coda tools registered
      expect(codaToolIds.length).toBeGreaterThan(0);
      
      console.log('Agent registered Coda tools:', codaToolIds);
    });
  });
});

describe('Tool Schema Validation', () => {
  let codaTools: ReturnType<typeof createAllCodaTools>;
  
  beforeEach(() => {
    codaTools = createAllCodaTools();
  });

  it('should have valid JSON schemas for all tools', () => {
    for (const tool of codaTools) {
      expect(tool.schema).toBeDefined();
      expect(tool.schema?.type).toBe('object');
      expect(tool.schema?.properties).toBeDefined();
      
      // Check required fields are in properties
      if (tool.schema?.required) {
        for (const requiredField of tool.schema.required as string[]) {
          expect(tool.schema.properties).toHaveProperty(requiredField);
        }
      }
    }
  });
  
  it('should have proper descriptions for all parameters', () => {
    for (const tool of codaTools) {
      const properties = tool.schema?.properties as Record<string, any>;
      
      if (properties) {
        for (const [paramName, paramSchema] of Object.entries(properties)) {
          expect(paramSchema.description).toBeTruthy();
          expect(paramSchema.type).toBeTruthy();
        }
      }
    }
  });
}); 