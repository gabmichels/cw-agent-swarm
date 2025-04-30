import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KnowledgeFlaggingService } from '../KnowledgeFlaggingService';
import { KnowledgeGraph } from '../../KnowledgeGraph';
import fs from 'fs';
import path from 'path';
import { FlaggedKnowledgeItem } from '../types';

// Mock fs and path modules
vi.mock('fs', async () => {
  return {
    default: {
      existsSync: vi.fn(),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      readFileSync: vi.fn(),
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  found: true,
                  title: 'Test Concept',
                  content: 'This is a test concept',
                  suggestedType: 'concept',
                  suggestedCategory: 'test-category',
                  confidence: 0.8,
                  reasoning: 'Test reasoning',
                  suggestedProperties: {
                    type: 'concept',
                    name: 'Test Concept',
                    description: 'Test description'
                  }
                })
              }
            }
          ]
        })
      }
    }
  }))
}));

// Mock KnowledgeGraph
vi.mock('../../KnowledgeGraph', () => ({
  KnowledgeGraph: vi.fn().mockImplementation(() => ({
    getDomain: vi.fn().mockReturnValue('test-domain'),
    getSummary: vi.fn().mockReturnValue({
      categories: ['test-category'],
      domain: 'test-domain',
      concepts: []
    }),
    findConcepts: vi.fn().mockReturnValue([]),
    addConcept: vi.fn().mockReturnValue('test-concept-id'),
    save: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('KnowledgeFlaggingService', () => {
  let service: KnowledgeFlaggingService;
  let mockGraph: KnowledgeGraph;
  let mockDataDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mocks
    (fs.existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    
    // Create test instances
    mockGraph = new KnowledgeGraph('test-domain');
    mockDataDir = 'test/data/dir';
    service = new KnowledgeFlaggingService(mockGraph, mockDataDir);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create the data directory if it does not exist', () => {
      expect(fs.existsSync).toHaveBeenCalledWith(mockDataDir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(mockDataDir, { recursive: true });
    });
  });

  describe('flagFromConversation', () => {
    it.skip('should extract knowledge and create a flagged item', async () => {
      const testConversation = 'This is a test conversation with some knowledge';
      const testContext = 'Test context';
      
      // Mock successful OpenAI response
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      found: true,
                      title: 'Test Concept',
                      content: 'This is a test concept',
                      suggestedType: 'concept',
                      suggestedCategory: 'test-category',
                      confidence: 0.8,
                      reasoning: 'Test reasoning',
                      suggestedProperties: {
                        type: 'concept',
                        name: 'Test Concept',
                        description: 'Test description'
                      }
                    })
                  }
                }
              ]
            })
          }
        }
      };
      
      // Temporarily override the OpenAI mock for this test
      (service as any).openai = mockOpenAI;
      
      // Mock file write
      (fs.writeFileSync as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {});
      
      // Mock UUID generation to ensure consistent IDs
      (service as any).generateId = () => 'test-id-123';
      
      const result = await service.flagFromConversation(testConversation, testContext);
      
      expect(result.success).toBe(true);
      expect(result.itemId).toBeDefined();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('getFlaggedItems', () => {
    it('should retrieve flagged items with filters', () => {
      // Setup test data
      const testItems: FlaggedKnowledgeItem[] = [
        {
          id: 'item1',
          title: 'Item 1',
          content: 'Content 1',
          sourceType: 'conversation',
          sourceReference: 'Ref 1',
          suggestedType: 'concept',
          suggestedCategory: 'category1',
          confidence: 0.8,
          status: 'pending',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          suggestedProperties: {
            type: 'concept',
            name: 'Test',
            description: 'Test description'
          }
        },
        {
          id: 'item2',
          title: 'Item 2',
          content: 'Content 2',
          sourceType: 'file',
          sourceReference: 'Ref 2',
          suggestedType: 'principle',
          suggestedCategory: 'category2',
          confidence: 0.6,
          status: 'approved',
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
          suggestedProperties: {
            type: 'principle',
            name: 'Test Principle',
            description: 'Test description',
            examples: ['Example 1'],
            applications: ['Application 1'],
            importance: 8
          }
        }
      ];
      
      // Set private property value
      (service as any).flaggedItems = new Map(testItems.map(item => [item.id, item]));
      
      // Test with no filter
      let result = service.getFlaggedItems();
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('item2'); // Sorted by date, newest first
      
      // Test with status filter
      result = service.getFlaggedItems({ status: 'pending' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('item1');
      
      // Test with sourceType filter
      result = service.getFlaggedItems({ sourceType: 'file' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('item2');
      
      // Test with multiple filters
      result = service.getFlaggedItems({ 
        suggestedType: 'concept',
        confidence: { min: 0.7 }
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('item1');
    });
  });

  describe('processApprovedItem', () => {
    it('should report error if item is not found', async () => {
      const result = await service.processApprovedItem('non-existent-id');
      expect(result.success).toBe(false);
    });
  });
}); 