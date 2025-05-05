import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MarketScannerManager, MarketScannerManagerOptions } from '../core/marketScannerManager';
import { ChloeMemory } from '../memory';
import { ChatOpenAI } from '@langchain/openai';
import { ImportanceLevel } from '../../../constants/memory';

// Mock dependencies to avoid actual API calls
vi.mock('../memory');
vi.mock('@langchain/openai');
vi.mock('../tools/marketScanner', () => ({
  createMarketScanner: vi.fn().mockReturnValue({
    initialize: vi.fn().mockResolvedValue(undefined),
    getTrends: vi.fn().mockResolvedValue([
      {
        name: 'AI in Marketing',
        category: 'Technology',
        stage: 'Growth',
        description: 'AI is transforming marketing strategies.',
        keywords: ['ai', 'marketing', 'automation'],
        estimatedBusinessImpact: 85,
        score: 92
      }
    ])
  })
}));

// Mock the new memory services instead of the direct Qdrant implementation
vi.mock('../../../server/memory/services', () => ({
  getMemoryServices: vi.fn().mockResolvedValue({
    embeddingService: {
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
    },
    memoryService: {
      addMemory: vi.fn().mockResolvedValue({ success: true, id: 'memory-123' })
    }
  })
}));

describe('MarketScannerManager', () => {
  let manager: MarketScannerManager;
  let mockMemory: any;
  let mockModel: any;
  let mockNotifyFunction: (message: string) => Promise<void>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock objects
    mockMemory = {
      getRelevantMemories: vi.fn().mockResolvedValue([]),
      addMemory: vi.fn().mockResolvedValue({ id: 'memory-123' })
    };

    mockModel = {
      invoke: vi.fn().mockResolvedValue({ content: 'Mock trend summary...' })
    };

    mockNotifyFunction = vi.fn().mockImplementation(async (message: string) => {
      return Promise.resolve();
    });

    // Create manager with default config
    const options: MarketScannerManagerOptions = {
      agentId: 'test-agent',
      memory: mockMemory as unknown as ChloeMemory,
      model: mockModel as unknown as ChatOpenAI,
      notifyFunction: mockNotifyFunction
    };
    
    manager = new MarketScannerManager(options);
  });

  test('should initialize successfully', async () => {
    await manager.initialize();
    expect(manager.isInitialized()).toBe(true);
  });

  test('should scan market trends with default configuration', async () => {
    await manager.initialize();
    const results = await manager.scanMarketTrends('digital marketing');
    
    expect(results).toContain('AI in Marketing');
    expect(mockMemory.addMemory).toHaveBeenCalledWith(
      expect.stringContaining('Market Scan Results for "digital marketing"'),
      expect.any(String),
      expect.any(String), // Should be using default importance level
      expect.any(String),
      undefined,
      expect.arrayContaining(['market_scan', 'trend_analysis', 'digital marketing'])
    );
  });

  test('should summarize trends with default configuration', async () => {
    await manager.initialize();
    const result = await manager.summarizeTrends();
    
    expect(result.success).toBe(true);
    expect(mockMemory.getRelevantMemories).toHaveBeenCalledWith(
      'market trends analysis scan', // default query
      10 // default limit
    );
  });

  test('should create manager with custom configuration', async () => {
    // Create manager with custom config
    const customOptions: MarketScannerManagerOptions = {
      agentId: 'test-agent',
      memory: mockMemory as unknown as ChloeMemory,
      model: mockModel as unknown as ChatOpenAI,
      notifyFunction: mockNotifyFunction,
      config: {
        limits: {
          relevantMemories: 5, // Override default 10
          textPreviewLength: 100 // Override default 200
        },
        importance: {
          marketScan: ImportanceLevel.LOW, // Override default MEDIUM
          trendSummary: ImportanceLevel.MEDIUM // Override default HIGH
        },
        queries: {
          marketTrends: 'custom market trends query'
        }
      }
    };
    
    const customManager = new MarketScannerManager(customOptions);
    await customManager.initialize();
    
    // Test that custom config is applied
    await customManager.summarizeTrends();
    
    expect(mockMemory.getRelevantMemories).toHaveBeenCalledWith(
      'custom market trends query', // custom query
      5 // custom limit
    );
    
    // Verify that the custom importance levels are used
    await customManager.scanMarketTrends('test query');
    expect(mockMemory.addMemory).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      ImportanceLevel.LOW, // Custom importance level
      expect.any(String),
      undefined,
      expect.any(Array)
    );
  });
}); 