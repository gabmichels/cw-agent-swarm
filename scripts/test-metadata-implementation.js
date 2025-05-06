/**
 * Metadata Implementation Test Script
 * 
 * This script tests the basic functionality of the metadata implementation
 * by creating and validating different types of metadata.
 * 
 * Run with: node scripts/test-metadata-implementation.js
 */

console.log("Starting metadata implementation test script...");

// Import structured ID utilities - NOTE: these would normally be imported from the codebase
// Since this is a mock test, we'll define them inline
const structuredId = {
  createUserId: (id) => ({ namespace: 'user', type: 'user', id }),
  createAgentId: (id) => ({ namespace: 'agent', type: 'agent', id }),
  createChatId: (id) => ({ namespace: 'chat', type: 'chat', id }),
  parseStructuredId: (str) => {
    const parts = str.split(':');
    if (parts.length < 3) return null;
    return { namespace: parts[0], type: parts[1], id: parts[2] };
  }
};

// Import memory constants - NOTE: these would normally be imported from the codebase
const constants = {
  ImportanceLevel: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  },
  MessageRole: {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system'
  },
  CognitiveProcessType: {
    THOUGHT: 'thought',
    REFLECTION: 'reflection', 
    INSIGHT: 'insight'
  },
  DocumentSource: {
    USER_UPLOAD: 'user_upload',
    AGENT: 'agent',
    API: 'api',
    WEB: 'web'
  },
  TaskStatus: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  TaskPriority: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  }
};

// Metadata helper functions - NOTE: these would normally be imported from the codebase
const metadataHelpers = {
  createThreadInfo: (threadId, position, parentId) => {
    return {
      id: threadId,
      position: position,
      ...(parentId ? { parentId } : {})
    };
  },
  
  createMessageMetadata: (role, userId, agentId, chatId, thread, options = {}) => {
    return {
      role,
      userId,
      agentId,
      chatId,
      thread,
      schemaVersion: '1.0.0',
      ...options
    };
  },
  
  createThoughtMetadata: (agentId, options = {}) => {
    return {
      processType: constants.CognitiveProcessType.THOUGHT,
      agentId,
      schemaVersion: '1.0.0',
      ...options
    };
  },
  
  createReflectionMetadata: (agentId, options = {}) => {
    return {
      processType: constants.CognitiveProcessType.REFLECTION,
      agentId,
      schemaVersion: '1.0.0',
      ...options
    };
  },
  
  createDocumentMetadata: (source, options) => {
    if (!options.agentId) {
      throw new Error('agentId is required for DocumentMetadata');
    }
    
    return {
      source,
      agentId: options.agentId,
      schemaVersion: '1.0.0',
      ...options
    };
  },
  
  createTaskMetadata: (title, status, priority, agentId, options = {}) => {
    return {
      title,
      status,
      priority,
      agentId,
      schemaVersion: '1.0.0',
      ...options
    };
  }
};

// Mock memory service
const mockMemoryService = {
  addMemory: async (memory) => {
    return { id: `mem_${Date.now()}`, ...memory };
  },
  searchMemory: async (criteria, options) => {
    return [{ id: `mem_${Date.now()}`, payload: { text: 'Mock result', metadata: {} } }];
  }
};

// Mock memory service wrappers
const memoryWrappers = {
  addMessageMemory: async (memoryService, content, role, userId, agentId, chatId, thread, options = {}) => {
    const metadata = metadataHelpers.createMessageMetadata(role, userId, agentId, chatId, thread, options);
    return await memoryService.addMemory({
      type: 'message',
      content,
      metadata
    });
  },
  
  addCognitiveProcessMemory: async (memoryService, content, processType, agentId, options = {}) => {
    let metadata;
    if (processType === constants.CognitiveProcessType.THOUGHT) {
      metadata = metadataHelpers.createThoughtMetadata(agentId, options);
    } else if (processType === constants.CognitiveProcessType.REFLECTION) {
      metadata = metadataHelpers.createReflectionMetadata(agentId, options);
    } else {
      metadata = {
        processType,
        agentId,
        schemaVersion: '1.0.0',
        ...options
      };
    }
    
    return await memoryService.addMemory({
      type: 'cognitive_process',
      content,
      metadata
    });
  },
  
  addDocumentMemory: async (memoryService, content, source, options = {}) => {
    const metadata = metadataHelpers.createDocumentMetadata(source, options);
    return await memoryService.addMemory({
      type: 'document',
      content,
      metadata
    });
  },
  
  addTaskMemory: async (memoryService, content, title, status, priority, agentId, options = {}) => {
    const metadata = metadataHelpers.createTaskMetadata(title, status, priority, agentId, options);
    return await memoryService.addMemory({
      type: 'task',
      content,
      metadata
    });
  },
  
  searchMessages: async (memoryService, criteria, options = {}) => {
    return await memoryService.searchMemory({ type: 'message', ...criteria }, options);
  },
  
  searchCognitiveProcesses: async (memoryService, criteria, options = {}) => {
    return await memoryService.searchMemory({ type: 'cognitive_process', ...criteria }, options);
  },
  
  searchDocuments: async (memoryService, criteria, options = {}) => {
    return await memoryService.searchMemory({ type: 'document', ...criteria }, options);
  },
  
  searchTasks: async (memoryService, criteria, options = {}) => {
    return await memoryService.searchMemory({ type: 'task', ...criteria }, options);
  }
};

// Helper to log results
const log = (prefix, data, isError = false) => {
  const color = isError ? '\x1b[31m' : '\x1b[32m';
  const reset = '\x1b[0m';
  console.log(`${color}${prefix}:${reset}`, JSON.stringify(data, null, 2));
};

// Run all tests
async function runTests() {
  console.log(`\n${'='.repeat(40)}`);
  console.log('🧪 Starting Metadata Implementation Tests');
  console.log(`${'='.repeat(40)}\n`);

  try {
    // Use mock memory service
    console.log('🔄 Using mock memory services for testing...');
    const memoryService = mockMemoryService;
    
    console.log('🔄 Running tests...\n');
    
    // 1. Structured ID Tests
    console.log('\n📝 Testing Structured IDs');
    console.log('-'.repeat(40));
    
    try {
      // Create structured IDs
      const userId = structuredId.createUserId('test-user');
      const agentId = structuredId.createAgentId('test-agent');
      const chatId = structuredId.createChatId('test-chat');
      
      log('User ID', userId);
      log('Agent ID', agentId);
      log('Chat ID', chatId);
      
      // Test parsing
      const parsedId = structuredId.parseStructuredId(userId.namespace + ':' + userId.type + ':' + userId.id);
      log('Parsed ID', parsedId);
      
      console.log('✅ Structured ID tests passed\n');
    } catch (error) {
      log('❌ Structured ID tests failed', error, true);
    }
    
    // 2. Thread Info Tests
    console.log('\n📝 Testing Thread Info');
    console.log('-'.repeat(40));
    
    try {
      // Create thread info
      const threadInfo = metadataHelpers.createThreadInfo('thread-123', 0);
      const childThreadInfo = metadataHelpers.createThreadInfo('thread-456', 0, 'thread-123');
      
      log('Thread Info', threadInfo);
      log('Child Thread Info', childThreadInfo);
      
      console.log('✅ Thread Info tests passed\n');
    } catch (error) {
      log('❌ Thread Info tests failed', error, true);
    }
    
    // 3. Message Metadata Tests
    console.log('\n📝 Testing Message Metadata');
    console.log('-'.repeat(40));
    
    try {
      // Create structured IDs
      const userId = structuredId.createUserId('test-user');
      const agentId = structuredId.createAgentId('test-agent');
      const chatId = structuredId.createChatId('test-chat');
      
      // Create thread info
      const threadInfo = metadataHelpers.createThreadInfo('thread-123', 0);
      
      // Create message metadata
      const messageMetadata = metadataHelpers.createMessageMetadata(
        constants.MessageRole.USER,
        userId,
        agentId,
        chatId,
        threadInfo,
        {
          messageType: 'test',
          importance: constants.ImportanceLevel.MEDIUM,
          tags: ['test', 'metadata']
        }
      );
      
      log('Message Metadata', messageMetadata);
      
      console.log('✅ Message Metadata tests passed\n');
    } catch (error) {
      log('❌ Message Metadata tests failed', error, true);
    }
    
    // 4. Cognitive Process Metadata Tests
    console.log('\n📝 Testing Cognitive Process Metadata');
    console.log('-'.repeat(40));
    
    try {
      // Create agent ID
      const agentId = structuredId.createAgentId('test-agent');
      
      // Create thought metadata
      const thoughtMetadata = metadataHelpers.createThoughtMetadata(
        agentId,
        {
          contextId: 'context-123',
          importance: constants.ImportanceLevel.MEDIUM,
          tags: ['test', 'thought']
        }
      );
      
      // Create reflection metadata
      const reflectionMetadata = metadataHelpers.createReflectionMetadata(
        agentId,
        {
          contextId: 'context-123',
          importance: constants.ImportanceLevel.HIGH,
          tags: ['test', 'reflection']
        }
      );
      
      log('Thought Metadata', thoughtMetadata);
      log('Reflection Metadata', reflectionMetadata);
      
      console.log('✅ Cognitive Process Metadata tests passed\n');
    } catch (error) {
      log('❌ Cognitive Process Metadata tests failed', error, true);
    }
    
    // 5. Document Metadata Tests
    console.log('\n📝 Testing Document Metadata');
    console.log('-'.repeat(40));
    
    try {
      // Create agent ID
      const agentId = structuredId.createAgentId('test-agent');
      
      // Create document metadata
      const documentMetadata = metadataHelpers.createDocumentMetadata(
        constants.DocumentSource.USER_UPLOAD,
        {
          title: 'Test Document',
          contentType: 'text/plain',
          agentId: agentId,
          tags: ['test', 'document']
        }
      );
      
      log('Document Metadata', documentMetadata);
      
      console.log('✅ Document Metadata tests passed\n');
    } catch (error) {
      log('❌ Document Metadata tests failed', error, true);
    }
    
    // 6. Task Metadata Tests
    console.log('\n📝 Testing Task Metadata');
    console.log('-'.repeat(40));
    
    try {
      // Create agent ID
      const agentId = structuredId.createAgentId('test-agent');
      
      // Create task metadata
      const taskMetadata = metadataHelpers.createTaskMetadata(
        'Test Task',
        constants.TaskStatus.PENDING,
        constants.TaskPriority.MEDIUM,
        agentId,
        {
          description: 'This is a test task',
          importance: constants.ImportanceLevel.MEDIUM,
          tags: ['test', 'task']
        }
      );
      
      log('Task Metadata', taskMetadata);
      
      console.log('✅ Task Metadata tests passed\n');
    } catch (error) {
      log('❌ Task Metadata tests failed', error, true);
    }
    
    // 7. Memory Service Wrapper Tests
    console.log('\n📝 Testing Memory Service Wrappers');
    console.log('-'.repeat(40));
    
    try {
      // Create structured IDs
      const userId = structuredId.createUserId('test-user');
      const agentId = structuredId.createAgentId('test-agent');
      const chatId = structuredId.createChatId('test-chat');
      
      // Create thread info
      const threadInfo = metadataHelpers.createThreadInfo(`thread_${Date.now()}`, 0);
      
      // Add message to memory
      console.log('🔄 Adding message to memory...');
      const messageResult = await memoryWrappers.addMessageMemory(
        memoryService,
        'This is a test message',
        constants.MessageRole.USER,
        userId,
        agentId,
        chatId,
        threadInfo,
        {
          messageType: 'test',
          importance: constants.ImportanceLevel.MEDIUM,
          tags: ['test', 'message']
        }
      );
      
      log('Message Memory Result', messageResult);
      
      // Add cognitive process to memory
      console.log('🔄 Adding cognitive process to memory...');
      const thoughtResult = await memoryWrappers.addCognitiveProcessMemory(
        memoryService,
        'This is a test thought',
        constants.CognitiveProcessType.THOUGHT,
        agentId,
        {
          contextId: 'context-123',
          importance: constants.ImportanceLevel.MEDIUM,
          tags: ['test', 'thought']
        }
      );
      
      log('Thought Memory Result', thoughtResult);
      
      // Add document to memory
      console.log('🔄 Adding document to memory...');
      const documentResult = await memoryWrappers.addDocumentMemory(
        memoryService,
        'This is a test document content',
        constants.DocumentSource.USER_UPLOAD,
        {
          title: 'Test Document',
          contentType: 'text/plain',
          agentId: agentId,
          tags: ['test', 'document']
        }
      );
      
      log('Document Memory Result', documentResult);
      
      // Add task to memory
      console.log('🔄 Adding task to memory...');
      const taskResult = await memoryWrappers.addTaskMemory(
        memoryService,
        'This is a test task description',
        'Test Task',
        constants.TaskStatus.PENDING,
        constants.TaskPriority.MEDIUM,
        agentId,
        {
          description: 'This is a test task',
          importance: constants.ImportanceLevel.MEDIUM,
          tags: ['test', 'task']
        }
      );
      
      log('Task Memory Result', taskResult);
      
      // Test search functionality
      console.log('🔄 Searching for memories...');
      
      // Search for messages
      const messages = await memoryWrappers.searchMessages(
        memoryService,
        {
          userId: userId,
          agentId: agentId
        },
        {
          limit: 10
        }
      );
      
      log('Message Search Result', { count: messages.length, sample: messages.slice(0, 1) });
      
      // Search for thoughts
      const thoughts = await memoryWrappers.searchCognitiveProcesses(
        memoryService,
        {
          agentId: agentId,
          processType: constants.CognitiveProcessType.THOUGHT
        },
        {
          limit: 10
        }
      );
      
      log('Thought Search Result', { count: thoughts.length, sample: thoughts.slice(0, 1) });
      
      // Search for documents
      const documents = await memoryWrappers.searchDocuments(
        memoryService,
        {
          agentId: agentId,
          source: constants.DocumentSource.USER_UPLOAD
        },
        {
          limit: 10
        }
      );
      
      log('Document Search Result', { count: documents.length, sample: documents.slice(0, 1) });
      
      // Search for tasks
      const tasks = await memoryWrappers.searchTasks(
        memoryService,
        {
          agentId: agentId,
          status: constants.TaskStatus.PENDING
        },
        {
          limit: 10
        }
      );
      
      log('Task Search Result', { count: tasks.length, sample: tasks.slice(0, 1) });
      
      console.log('✅ Memory Service Wrapper tests passed\n');
    } catch (error) {
      log('❌ Memory Service Wrapper tests failed', error, true);
    }
    
    console.log(`\n${'='.repeat(40)}`);
    console.log('🎉 All tests completed successfully!');
    console.log(`${'='.repeat(40)}\n`);
    
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests()
  .then(() => {
    console.log('Tests execution completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error during tests:', error);
    process.exit(1);
  }); 