/**
 * EnhancedMemoryManager.test.ts - Tests for the EnhancedMemoryManager implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedMemoryManager } from '../managers/EnhancedMemoryManager';
import { CognitivePatternType, CognitiveReasoningType, AssociationStrength } from '../interfaces/CognitiveMemory.interface';
import { MemoryChangeType } from '../interfaces/MemoryVersionHistory.interface';
import { ManagerType } from '../../base/managers/ManagerType';

// Mock the dependencies
vi.mock('../../../../lib/agents/implementations/managers/DefaultMemoryManager');
vi.mock('../summarization/DefaultConversationSummarizer');
vi.mock('../history/DefaultMemoryVersionHistory');

// Test agent mock
const mockAgent = {
  getAgentId: vi.fn().mockReturnValue('test-agent'),
  getName: vi.fn().mockReturnValue('Test Agent'),
};

describe('EnhancedMemoryManager', () => {
  let manager: EnhancedMemoryManager;
  
  beforeEach(async () => {
    // Create a fresh manager instance for each test
    manager = new EnhancedMemoryManager(mockAgent as any, {
      enabled: true,
      enableCognitiveMemory: true,
      enableConversationSummarization: true,
      enableVersionHistory: true
    });
    
    // Mock initialization
    manager.initialize = vi.fn().mockResolvedValue(true);
    
    // Initialize manager
    await manager.initialize();
    
    // Set initialized flag directly since mocking doesn't set it
    // @ts-ignore - Accessing private property for testing
    manager.initialized = true;
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Base manager functionality', () => {
    it('should be properly initialized', () => {
      expect(manager).toBeDefined();
      expect(manager.getType()).toBe(ManagerType.MEMORY);
      expect(manager.isInitialized()).toBe(true);
    });
    
    it('should use composition for the base memory manager', () => {
      // @ts-ignore - Accessing private property for testing
      expect(manager.baseMemoryManager).toBeDefined();
    });
  });
  
  describe('Memory operations', () => {
    it('should delegate addMemory to base memory manager', async () => {
      // @ts-ignore - Mock the internal baseMemoryManager
      manager.baseMemoryManager.addMemory = vi.fn().mockResolvedValue({
        id: 'memory-1',
        content: 'Test memory',
        metadata: {},
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0
      });
      
      const result = await manager.addMemory('Test memory', { test: true });
      
      // @ts-ignore - Check that the method was called
      expect(manager.baseMemoryManager.addMemory).toHaveBeenCalledWith('Test memory', { test: true });
      expect(result.id).toBe('memory-1');
    });
    
    it('should delegate searchMemories to base memory manager', async () => {
      // @ts-ignore - Mock the internal baseMemoryManager
      manager.baseMemoryManager.searchMemories = vi.fn().mockResolvedValue([{
        id: 'memory-1',
        content: 'Test memory',
        metadata: {},
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0
      }]);
      
      const result = await manager.searchMemories('test', { limit: 10 });
      
      // @ts-ignore - Check that the method was called
      expect(manager.baseMemoryManager.searchMemories).toHaveBeenCalledWith('test', { limit: 10 });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('memory-1');
    });
  });
  
  describe('Version history operations', () => {
    it('should create memory versions', async () => {
      // @ts-ignore - Mock necessary methods
      manager.verifyMemoryExists = vi.fn().mockResolvedValue({ id: 'memory-1' });
      // @ts-ignore
      manager.versionHistory.createVersion = vi.fn().mockResolvedValue({
        versionId: 'version-1',
        memoryId: 'memory-1',
        content: 'Test content',
        changeType: MemoryChangeType.CREATED,
        timestamp: new Date()
      });
      
      const result = await manager.createMemoryVersion('memory-1', 'Test content', MemoryChangeType.CREATED);
      
      // @ts-ignore
      expect(manager.versionHistory.createVersion).toHaveBeenCalledWith(
        'memory-1', 
        'Test content', 
        MemoryChangeType.CREATED, 
        undefined
      );
      
      expect(result.versionId).toBe('version-1');
    });
    
    it('should throw error when version history is disabled', async () => {
      // Create manager with version history disabled
      const noVersionsManager = new EnhancedMemoryManager(mockAgent as any, {
        enableVersionHistory: false
      });
      
      await expect(
        noVersionsManager.createMemoryVersion('memory-1', 'Test content')
      ).rejects.toThrow('Version history is disabled');
    });
  });
  
  describe('Cognitive memory operations', () => {
    it('should create associations between memories', async () => {
      // @ts-ignore - Mock necessary methods
      manager.verifyMemoryExists = vi.fn().mockImplementation((id) => Promise.resolve({ id }));
      // @ts-ignore - Mock findAssociations to return empty array (no existing associations)
      manager.findAssociations = vi.fn().mockResolvedValue([]);
      
      const result = await manager.createAssociation(
        'memory-1',
        'memory-2',
        CognitivePatternType.CONCEPTUAL,
        'Test association',
        {
          strength: AssociationStrength.STRONG,
          score: 0.8
        }
      );
      
      expect(result).toBeDefined();
      expect(result.sourceMemoryId).toBe('memory-1');
      expect(result.targetMemoryId).toBe('memory-2');
      expect(result.associationType).toBe(CognitivePatternType.CONCEPTUAL);
      expect(result.description).toBe('Test association');
      expect(result.strength).toBe(AssociationStrength.STRONG);
      expect(result.score).toBe(0.8);
    });
    
    it('should throw error when cognitive memory is disabled', async () => {
      // Create manager with cognitive memory disabled
      const noCognitiveManager = new EnhancedMemoryManager(mockAgent as any, {
        enableCognitiveMemory: false
      });
      
      await expect(
        noCognitiveManager.createAssociation(
          'memory-1',
          'memory-2',
          CognitivePatternType.CONCEPTUAL,
          'Test association'
        )
      ).rejects.toThrow('Cognitive memory is disabled');
    });
    
    it('should synthesize memories', async () => {
      // @ts-ignore - Mock necessary methods
      manager.verifyMemoryExists = vi.fn().mockImplementation((id) => Promise.resolve({ 
        id, 
        content: `Memory content for ${id}` 
      }));
      
      const result = await manager.synthesizeMemories({
        memoryIds: ['memory-1', 'memory-2'],
        patternType: CognitivePatternType.CONCEPTUAL
      });
      
      expect(result).toBeDefined();
      expect(result.sourceMemoryIds).toEqual(['memory-1', 'memory-2']);
      expect(result.patternType).toBe(CognitivePatternType.CONCEPTUAL);
      expect(result.content).toContain('Synthesis');
    });
    
    it('should reason across memories', async () => {
      // @ts-ignore - Mock necessary methods
      manager.verifyMemoryExists = vi.fn().mockImplementation((id) => Promise.resolve({ 
        id, 
        content: `Memory content for ${id}` 
      }));
      
      const result = await manager.reasonAcrossMemories({
        memoryIds: ['memory-1', 'memory-2'],
        reasoningType: CognitiveReasoningType.INDUCTIVE,
        prompt: 'Find patterns'
      });
      
      expect(result).toBeDefined();
      expect(result.memoryIds).toEqual(['memory-1', 'memory-2']);
      expect(result.reasoningType).toBe(CognitiveReasoningType.INDUCTIVE);
      expect(result.prompt).toBe('Find patterns');
      expect(result.result).toContain('Reasoning');
    });
  });
  
  describe('Conversation summarization', () => {
    it('should delegate summarization to conversation summarizer', async () => {
      // @ts-ignore - Mock the internal conversationSummarizer
      manager.conversationSummarizer.summarizeConversation = vi.fn().mockResolvedValue({
        summary: 'Test summary',
        topics: ['topic1', 'topic2'],
        participants: ['user', 'agent'],
        duration: 60
      });
      
      const result = await manager.summarizeConversation({ maxLength: 100 });
      
      // @ts-ignore - Check that the method was called
      expect(manager.conversationSummarizer.summarizeConversation).toHaveBeenCalledWith({ maxLength: 100 });
      expect(result.summary).toBe('Test summary');
    });
    
    it('should throw error when summarization is disabled', async () => {
      // Create manager with summarization disabled
      const noSummarizationManager = new EnhancedMemoryManager(mockAgent as any, {
        enableConversationSummarization: false
      });
      
      await expect(
        noSummarizationManager.summarizeConversation()
      ).rejects.toThrow('Conversation summarization is disabled');
    });
  });
  
  describe('Enhanced memory operations', () => {
    it('should get enhanced memory', async () => {
      // @ts-ignore - Mock necessary methods
      manager.verifyMemoryExists = vi.fn().mockResolvedValue({
        id: 'memory-1',
        content: 'Test memory',
        metadata: {},
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0
      });
      
      // @ts-ignore - Mock findAssociations
      manager.findAssociations = vi.fn().mockResolvedValue([]);
      
      // @ts-ignore - Mock getMemoryVersions to prevent error
      manager.getMemoryVersions = vi.fn().mockResolvedValue([]);
      
      const result = await manager.getEnhancedMemory('memory-1');
      
      expect(result).toBeDefined();
      expect(result?.id).toBe('memory-1');
      expect(result?.importance).toBe(0.5); // Default value
      expect(result?.novelty).toBe(0.5); // Default value
      expect(result?.emotionalValence).toBe(0); // Default value
    });
    
    it('should process memory cognitively', async () => {
      // @ts-ignore - Mock necessary methods
      manager.getEnhancedMemory = vi.fn().mockResolvedValue({
        id: 'memory-1',
        content: 'Test memory',
        metadata: {},
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0,
        associations: [],
        importance: 0.5,
        novelty: 0.5,
        emotionalValence: 0,
        categories: [],
        cognitivelyProcessed: false
      });
      
      // @ts-ignore - Mock methods that will be called
      manager.getRecentMemories = vi.fn().mockResolvedValue([
        { id: 'memory-2', content: 'Another memory' }
      ]);
      
      // @ts-ignore
      manager.discoverAssociations = vi.fn().mockResolvedValue([]);
      // @ts-ignore
      manager.rateMemoryImportance = vi.fn().mockResolvedValue(0.7);
      // @ts-ignore
      manager.rateMemoryNovelty = vi.fn().mockResolvedValue(0.6);
      // @ts-ignore
      manager.analyzeMemoryEmotion = vi.fn().mockResolvedValue(0.3);
      // @ts-ignore
      manager.categorizeMemory = vi.fn().mockResolvedValue(['test-category']);
      
      // @ts-ignore
      manager.enhancedMemories = new Map();
      
      const result = await manager.processMemoryCognitively('memory-1');
      
      expect(result).toBeDefined();
      expect(result.cognitivelyProcessed).toBe(true);
      expect(result.lastCognitiveProcessingTime).toBeDefined();
    });
  });
}); 