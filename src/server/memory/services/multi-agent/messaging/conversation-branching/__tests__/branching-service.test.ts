/**
 * Conversation Branching Service Tests
 * 
 * This file contains tests for the ConversationBranchingService, testing branch creation,
 * message management, branch relationships, and branch merging.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversationBranchingService } from '../branching-service';
import { 
  BranchType,
  BranchStatus,
  BranchRelationship,
  MergeStrategy,
  ConversationBranch,
  BranchMessage
} from '../branching-interface';
import { AnyMemoryService } from '../../../../memory/memory-service-wrappers';
import { MemoryType } from '../../../../../config';
import { v4 as uuidv4 } from 'uuid';

// Mock UUID
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-123'
}));

// Mock dependencies
vi.mock('../../factory', () => ({
  MessagingFactory: {
    getConversationManager: vi.fn().mockResolvedValue({
      getConversation: vi.fn().mockResolvedValue({
        id: 'conv-123',
        participants: [{ id: 'user-1', type: 'user' }]
      })
    })
  }
}));

// Mock memory types
const MEMORY_TYPE = {
  BRANCH: 'conversation_branch' as unknown as MemoryType,
  BRANCH_MESSAGE: 'branch_message' as unknown as MemoryType
};

// Mock memory service
const mockAddMemory = vi.fn().mockResolvedValue({ success: true, id: 'mock-memory-id' });
const mockSearchMemories = vi.fn().mockResolvedValue([]);
const mockUpdateMemory = vi.fn().mockResolvedValue(true);
const mockDeleteMemory = vi.fn().mockResolvedValue(true);

const mockMemoryService = {
  addMemory: mockAddMemory,
  searchMemories: mockSearchMemories,
  updateMemory: mockUpdateMemory,
  deleteMemory: mockDeleteMemory
} as unknown as AnyMemoryService;

// Test data
const TEST_CONVERSATION_ID = 'conv-123';
const TEST_BRANCH_ID = 'mock-uuid-123';
const TEST_USER_ID = 'user-1';
const TEST_AGENT_ID = 'agent-1';

describe('ConversationBranchingService', () => {
  let branchingService: ConversationBranchingService;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Create a new instance of service
    branchingService = new ConversationBranchingService(mockMemoryService);
    
    // Mock Date.now to return a consistent timestamp
    vi.spyOn(Date, 'now').mockImplementation(() => 1234567890);
    
    // Ensure UUID is mocked consistently
    const { v4 } = require('uuid');
    if (typeof v4 === 'function') {
      vi.spyOn(require('uuid'), 'v4').mockImplementation(() => TEST_BRANCH_ID);
    }
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('createBranch', () => {
    it('should create a new branch - debugging', async () => {
      try {
        // Mock UUID consistently
        vi.spyOn(require('uuid'), 'v4').mockReturnValue('mock-uuid-123');
        
        // Set up mocks more explicitly
        mockAddMemory.mockImplementation((data) => {
          console.log('Mock addMemory called with:', JSON.stringify(data, null, 2));
          return Promise.resolve({ success: true, id: 'mock-memory-id' });
        });
        
        mockSearchMemories.mockImplementation((query) => {
          console.log('Mock searchMemories called with:', JSON.stringify(query, null, 2));
          
          if (query.type === MEMORY_TYPE.BRANCH && query.filter && query.filter['metadata.id'] === TEST_BRANCH_ID) {
            return Promise.resolve([{
              payload: {
                metadata: {
                  id: TEST_BRANCH_ID,
                  conversationId: TEST_CONVERSATION_ID,
                  name: 'Test Branch',
                  description: 'A test branch',
                  branchType: BranchType.ALTERNATIVE,
                  status: BranchStatus.ACTIVE,
                  createdBy: TEST_USER_ID,
                  participants: [TEST_USER_ID],
                  messageCount: 0,
                  relationships: [],
                  relatedBranches: [],
                  createdAt: 1234567890,
                  updatedAt: 1234567890
                }
              }
            }]);
          }
          
          return Promise.resolve([]);
        });
        
        const branchOptions = {
          name: 'Test Branch',
          description: 'A test branch',
          branchType: BranchType.ALTERNATIVE,
          initialMessage: {
            senderId: TEST_USER_ID,
            content: 'Initial message',
            format: 'text'
          }
        };
        
        const branch = await branchingService.createBranch(TEST_CONVERSATION_ID, branchOptions);
        console.log('Created branch:', JSON.stringify(branch, null, 2));
        
        expect(branch).toBeDefined();
        expect(branch.id).toBe(TEST_BRANCH_ID);
        expect(branch.name).toBe(branchOptions.name);
      } catch (error) {
        console.error('Test failed with error:', error);
        throw error;
      }
    });
    
    it('should create a new branch', async () => {
      try {
        const branchOptions = {
          name: 'Test Branch',
          description: 'A test branch',
          branchType: BranchType.ALTERNATIVE,
          initialMessage: {
            senderId: TEST_USER_ID,
            content: 'Initial message',
            format: 'text'
          }
        };
        
        // Mock the conversation manager to return the conversation
        const { MessagingFactory } = await import('../../factory');
        MessagingFactory.getConversationManager = vi.fn().mockResolvedValue({
          getConversation: vi.fn().mockResolvedValue({
            id: 'conv-123',
            participants: [{ id: 'user-1', type: 'user' }]
          })
        });
        
        // Mock the response for message creation
        mockSearchMemories.mockResolvedValueOnce([{
          payload: {
            metadata: {
              id: TEST_BRANCH_ID,
              conversationId: TEST_CONVERSATION_ID,
              name: branchOptions.name,
              description: branchOptions.description,
              branchType: branchOptions.branchType,
              status: BranchStatus.ACTIVE,
              createdBy: TEST_USER_ID,
              participants: [TEST_USER_ID],
              messageCount: 0,
              relationships: [],
              relatedBranches: []
            }
          }
        }]);
        
        // Mock the response for branch update
        mockSearchMemories.mockResolvedValueOnce([{
          payload: {
            metadata: {
              id: TEST_BRANCH_ID,
              conversationId: TEST_CONVERSATION_ID,
              name: branchOptions.name,
              description: branchOptions.description,
              branchType: branchOptions.branchType,
              status: BranchStatus.ACTIVE,
              createdBy: TEST_USER_ID,
              participants: [TEST_USER_ID],
              messageCount: 0,
              relationships: [],
              relatedBranches: []
            }
          }
        }]);
        
        const branch = await branchingService.createBranch(TEST_CONVERSATION_ID, branchOptions);
        
        expect(branch.name).toBe(branchOptions.name);
        expect(branch.description).toBe(branchOptions.description);
        expect(branch.branchType).toBe(BranchType.ALTERNATIVE);
        expect(branch.status).toBe(BranchStatus.ACTIVE);
        expect(branch.conversationId).toBe(TEST_CONVERSATION_ID);
        expect(branch.createdAt).toBe(1234567890);
        expect(mockAddMemory).toHaveBeenCalledTimes(3);
      } catch (error) {
        console.error('Test failed with error:', error);
        throw error;
      }
    });
    
    it('should create a branch with parent-child relationship', async () => {
      const parentBranchId = 'parent-branch-123';
      
      const branchOptions = {
        name: 'Child Branch',
        description: 'A child branch',
        branchType: BranchType.EXPLORATION,
        parentBranchId: parentBranchId
      };
      
      // Mock response for parent branch check
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: parentBranchId,
            conversationId: TEST_CONVERSATION_ID,
            name: 'Parent Branch',
            description: 'A parent branch',
            branchType: BranchType.ALTERNATIVE,
            status: BranchStatus.ACTIVE,
            relationships: [],
            relatedBranches: []
          }
        }
      }]);
      
      // Mock response for parent branch update
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: parentBranchId,
            conversationId: TEST_CONVERSATION_ID,
            name: 'Parent Branch',
            description: 'A parent branch',
            branchType: BranchType.ALTERNATIVE,
            status: BranchStatus.ACTIVE,
            relationships: [],
            relatedBranches: []
          }
        }
      }]);
      
      const branch = await branchingService.createBranch(TEST_CONVERSATION_ID, branchOptions);
      
      expect(branch.name).toBe(branchOptions.name);
      expect(branch.parentBranchId).toBe(parentBranchId);
      expect(branch.relationships).toContain(BranchRelationship.PARENT);
      expect(branch.relatedBranches).toHaveLength(1);
      expect(branch.relatedBranches[0].branchId).toBe(parentBranchId);
      expect(branch.relatedBranches[0].relationship).toBe(BranchRelationship.PARENT);
      expect(mockAddMemory).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('addMessage', () => {
    it('should add a message to a branch', async () => {
      // Mock branch retrieval
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: TEST_BRANCH_ID,
            conversationId: TEST_CONVERSATION_ID,
            name: 'Test Branch',
            description: 'A test branch',
            branchType: BranchType.ALTERNATIVE,
            status: BranchStatus.ACTIVE,
            createdBy: TEST_USER_ID,
            participants: [TEST_USER_ID],
            messageCount: 0,
            relationships: [],
            relatedBranches: []
          }
        }
      }]);
      
      // Mock branch update retrieval
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: TEST_BRANCH_ID,
            conversationId: TEST_CONVERSATION_ID,
            name: 'Test Branch',
            description: 'A test branch',
            branchType: BranchType.ALTERNATIVE,
            status: BranchStatus.ACTIVE,
            createdBy: TEST_USER_ID,
            participants: [TEST_USER_ID],
            messageCount: 0,
            relationships: [],
            relatedBranches: []
          }
        }
      }]);
      
      const message = {
        conversationId: TEST_CONVERSATION_ID,
        senderId: TEST_USER_ID,
        content: 'Hello world',
        format: 'text',
        isVisibleToAll: true
      };
      
      const result = await branchingService.addMessage(TEST_BRANCH_ID, message);
      
      expect(result.branchId).toBe(TEST_BRANCH_ID);
      expect(result.senderId).toBe(TEST_USER_ID);
      expect(result.content).toBe('Hello world');
      expect(result.format).toBe('text');
      expect(result.timestamp).toBe(1234567890);
      expect(mockAddMemory).toHaveBeenCalledTimes(2); // One for message, one for branch update
    });
    
    it('should update branch metadata when adding first message', async () => {
      // Mock branch retrieval
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: TEST_BRANCH_ID,
            conversationId: TEST_CONVERSATION_ID,
            name: 'Test Branch',
            description: 'A test branch',
            branchType: BranchType.ALTERNATIVE,
            status: BranchStatus.ACTIVE,
            createdBy: TEST_USER_ID,
            participants: [TEST_USER_ID],
            messageCount: 0,
            relationships: [],
            relatedBranches: []
          }
        }
      }]);
      
      // Mock branch update retrieval
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: TEST_BRANCH_ID,
            conversationId: TEST_CONVERSATION_ID,
            name: 'Test Branch',
            description: 'A test branch',
            branchType: BranchType.ALTERNATIVE,
            status: BranchStatus.ACTIVE,
            createdBy: TEST_USER_ID,
            participants: [TEST_USER_ID],
            messageCount: 0,
            relationships: [],
            relatedBranches: []
          }
        }
      }]);
      
      const message = {
        conversationId: TEST_CONVERSATION_ID,
        senderId: TEST_USER_ID,
        content: 'First message',
        format: 'text',
        isVisibleToAll: true
      };
      
      await branchingService.addMessage(TEST_BRANCH_ID, message);
      
      // Verify branch update was called with correct parameters
      expect(mockAddMemory).toHaveBeenCalledTimes(2);
      expect(mockAddMemory.mock.calls[1][0].metadata.messageCount).toBe(1);
      expect(mockAddMemory.mock.calls[1][0].metadata.lastMessageId).toBeDefined();
      expect(mockAddMemory.mock.calls[1][0].metadata.updatedAt).toBe(1234567890);
    });
  });
  
  describe('getMessages', () => {
    it('should retrieve messages for a branch', async () => {
      // Mock message retrieval
      mockSearchMemories.mockResolvedValueOnce([
        {
          payload: {
            metadata: {
              id: 'msg-1',
              branchId: TEST_BRANCH_ID,
              conversationId: TEST_CONVERSATION_ID,
              senderId: TEST_USER_ID,
              content: 'Message 1',
              format: 'text',
              timestamp: 1234567000,
              isVisibleToAll: true
            }
          }
        },
        {
          payload: {
            metadata: {
              id: 'msg-2',
              branchId: TEST_BRANCH_ID,
              conversationId: TEST_CONVERSATION_ID,
              senderId: TEST_AGENT_ID,
              content: 'Message 2',
              format: 'text',
              timestamp: 1234567100,
              isVisibleToAll: true
            }
          }
        }
      ]);
      
      const messages = await branchingService.getMessages(TEST_BRANCH_ID);
      
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].senderId).toBe(TEST_USER_ID);
      expect(messages[1].id).toBe('msg-2');
      expect(messages[1].senderId).toBe(TEST_AGENT_ID);
      expect(mockSearchMemories).toHaveBeenCalledWith({
        type: MEMORY_TYPE.BRANCH_MESSAGE,
        filter: {
          'metadata.branchId': TEST_BRANCH_ID
        },
        limit: 100,
        offset: 0
      });
    });
    
    it('should apply pagination options when retrieving messages', async () => {
      // Mock message retrieval with empty result (we only care about the params)
      mockSearchMemories.mockResolvedValueOnce([]);
      
      await branchingService.getMessages(TEST_BRANCH_ID, {
        limit: 5,
        offset: 10,
        sortDirection: 'desc'
      });
      
      expect(mockSearchMemories).toHaveBeenCalledWith({
        type: MEMORY_TYPE.BRANCH_MESSAGE,
        filter: {
          'metadata.branchId': TEST_BRANCH_ID
        },
        limit: 5,
        offset: 10
      });
    });
  });
  
  describe('mergeBranches', () => {
    it('should merge branches using APPEND strategy', async () => {
      // Mock source branch retrieval
      mockSearchMemories.mockImplementation((query) => {
        // Source branch
        if (query.filter && query.filter['metadata.branchId'] === 'source-branch') {
          return Promise.resolve([
            {
              payload: {
                metadata: {
                  id: 'msg-1',
                  branchId: 'source-branch',
                  conversationId: TEST_CONVERSATION_ID,
                  senderId: TEST_USER_ID,
                  content: 'Message 1',
                  format: 'text',
                  timestamp: 1234567000,
                  isVisibleToAll: true
                }
              }
            }
          ]);
        }
        
        // Target branch
        if (query.filter && query.filter['metadata.id'] === 'target-branch') {
          return Promise.resolve([{
            payload: {
              metadata: {
                id: 'target-branch',
                conversationId: TEST_CONVERSATION_ID,
                name: 'Target Branch',
                branchType: BranchType.ALTERNATIVE,
                status: BranchStatus.ACTIVE,
                relationships: [],
                relatedBranches: [],
                messageCount: 0
              }
            }
          }]);
        }
        
        // Source branch
        if (query.filter && query.filter['metadata.id'] === 'source-branch') {
          return Promise.resolve([{
            payload: {
              metadata: {
                id: 'source-branch',
                conversationId: TEST_CONVERSATION_ID,
                name: 'Source Branch',
                branchType: BranchType.EXPLORATION,
                status: BranchStatus.ACTIVE,
                relationships: [],
                relatedBranches: []
              }
            }
          }]);
        }
        
        return Promise.resolve([]);
      });
      
      // Mock the add message function to return a successful message
      mockAddMemory.mockImplementation((data) => {
        if (data.type === MEMORY_TYPE.BRANCH_MESSAGE) {
          return Promise.resolve({
            success: true,
            id: 'new-message-id'
          });
        }
        return Promise.resolve({ success: true, id: 'mock-memory-id' });
      });
      
      // Mock success for results
      vi.spyOn(branchingService as any, 'updateBranchRelationships').mockImplementation(() => Promise.resolve());
      
      const mergeOptions = {
        sourceBranchId: 'source-branch',
        targetBranchId: 'target-branch',
        strategy: MergeStrategy.APPEND,
        mergeReason: 'Testing merge'
      };
      
      const result = await branchingService.mergeBranches(mergeOptions);
      
      expect(result.success).toBe(true);
      expect(result.mergedMessageIds.length).toBeGreaterThan(0);
      expect(result.targetBranchId).toBe('target-branch');
      expect(result.errors).toBeUndefined();
    });
    
    it('should handle errors during merge', async () => {
      // Mock source branch retrieval
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: 'source-branch',
            conversationId: TEST_CONVERSATION_ID,
            name: 'Source Branch',
            branchType: BranchType.EXPLORATION,
            status: BranchStatus.ACTIVE,
            relationships: [],
            relatedBranches: []
          }
        }
      }]);
      
      // Mock target branch retrieval
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: 'target-branch',
            conversationId: TEST_CONVERSATION_ID,
            name: 'Target Branch',
            branchType: BranchType.ALTERNATIVE,
            status: BranchStatus.ACTIVE,
            relationships: [],
            relatedBranches: []
          }
        }
      }]);
      
      // Mock source messages retrieval
      mockSearchMemories.mockResolvedValueOnce([
        {
          payload: {
            metadata: {
              id: 'msg-1',
              branchId: 'source-branch',
              conversationId: TEST_CONVERSATION_ID,
              senderId: TEST_USER_ID,
              content: 'Message 1',
              format: 'text',
              timestamp: 1234567000,
              isVisibleToAll: true
            }
          }
        }
      ]);
      
      // Make addMessage fail
      mockAddMemory.mockRejectedValueOnce(new Error('Test error'));
      
      const mergeOptions = {
        sourceBranchId: 'source-branch',
        targetBranchId: 'target-branch',
        strategy: MergeStrategy.APPEND,
        mergeReason: 'Testing merge'
      };
      
      const result = await branchingService.mergeBranches(mergeOptions);
      
      expect(result.success).toBe(false);
      expect(result.mergedMessageIds).toHaveLength(0);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('Error merging message');
    });
  });
  
  describe('compareBranches', () => {
    it('should identify common messages between branches', async () => {
      // Mock branch retrieval
      mockSearchMemories.mockImplementation((query) => {
        // First branch messages
        if (query.type === MEMORY_TYPE.BRANCH_MESSAGE && query.filter && query.filter['metadata.branchId'] === 'branch-1') {
          return Promise.resolve([
            {
              payload: {
                metadata: {
                  id: 'msg-1',
                  branchId: 'branch-1',
                  conversationId: TEST_CONVERSATION_ID,
                  senderId: TEST_USER_ID,
                  content: 'Common message',
                  format: 'text',
                  timestamp: 1234567000,
                  isVisibleToAll: true
                }
              }
            },
            {
              payload: {
                metadata: {
                  id: 'msg-2',
                  branchId: 'branch-1',
                  conversationId: TEST_CONVERSATION_ID,
                  senderId: TEST_USER_ID,
                  content: 'Unique to branch 1',
                  format: 'text',
                  timestamp: 1234567100,
                  isVisibleToAll: true
                }
              }
            }
          ]);
        }
        
        // Second branch messages
        if (query.type === MEMORY_TYPE.BRANCH_MESSAGE && query.filter && query.filter['metadata.branchId'] === 'branch-2') {
          return Promise.resolve([
            {
              payload: {
                metadata: {
                  id: 'msg-3',
                  branchId: 'branch-2',
                  conversationId: TEST_CONVERSATION_ID,
                  senderId: TEST_USER_ID,
                  content: 'Common message',
                  format: 'text',
                  timestamp: 1234567000,
                  isVisibleToAll: true
                }
              }
            },
            {
              payload: {
                metadata: {
                  id: 'msg-4',
                  branchId: 'branch-2',
                  conversationId: TEST_CONVERSATION_ID,
                  senderId: TEST_USER_ID,
                  content: 'Unique to branch 2',
                  format: 'text',
                  timestamp: 1234567200,
                  isVisibleToAll: true
                }
              }
            }
          ]);
        }
        
        // Branch-1 info
        if (query.type === MEMORY_TYPE.BRANCH && query.filter && query.filter['metadata.id'] === 'branch-1') {
          return Promise.resolve([{
            payload: {
              metadata: {
                id: 'branch-1',
                conversationId: TEST_CONVERSATION_ID,
                name: 'Branch 1',
                branchType: BranchType.EXPLORATION,
                status: BranchStatus.ACTIVE,
                relationships: [],
                relatedBranches: []
              }
            }
          }]);
        }
        
        // Branch-2 info
        if (query.type === MEMORY_TYPE.BRANCH && query.filter && query.filter['metadata.id'] === 'branch-2') {
          return Promise.resolve([{
            payload: {
              metadata: {
                id: 'branch-2',
                conversationId: TEST_CONVERSATION_ID,
                name: 'Branch 2',
                branchType: BranchType.EXPLORATION,
                status: BranchStatus.ACTIVE,
                relationships: [],
                relatedBranches: []
              }
            }
          }]);
        }
        
        return Promise.resolve([]);
      });
      
      // Mock findCommonAncestor to return null (no common ancestor)
      vi.spyOn(branchingService as any, 'findCommonAncestor').mockResolvedValue(null);
      
      const result = await branchingService.compareBranches('branch-1', 'branch-2');
      
      expect(result.commonMessages.length).toBeGreaterThan(0); // Should find common messages
      expect(result.uniqueToFirst.length).toBeGreaterThan(0);  // Should find messages unique to branch 1
      expect(result.uniqueToSecond.length).toBeGreaterThan(0); // Should find messages unique to branch 2
    });
  });
}); 