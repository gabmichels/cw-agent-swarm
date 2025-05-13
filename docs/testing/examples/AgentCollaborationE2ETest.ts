// @ts-ignore - These imports would exist in actual implementation
import { AgentBase } from '../../src/agents/shared/interfaces/AgentBase.interface';
// @ts-ignore - These imports would exist in actual implementation
import { DefaultAgentFactory } from '../../src/agents/shared/factories/DefaultAgentFactory';
// @ts-ignore - These imports would exist in actual implementation
import { MessageType, MessagePriority, MessageStatus } from '../../src/agents/shared/interfaces/AgentMessaging.interface';
// @ts-ignore - These imports would exist in actual implementation
import { CapabilityType, AccessMode } from '../../src/agents/shared/types/CapabilityTypes';

describe('Agent Collaboration E2E Tests', () => {
  let agentFactory: DefaultAgentFactory;
  let researchAgent: AgentBase;
  let writingAgent: AgentBase;
  let coordinatorAgent: AgentBase;
  
  // Setup before all tests
  beforeAll(async () => {
    // Create agent factory
    agentFactory = new DefaultAgentFactory();
    
    // Initialize research agent
    researchAgent = await agentFactory.createAgent({
      agentId: 'research-agent-' + Date.now(),
      config: {
        enableMemoryManager: true,
        enableKnowledgeManager: true,
        enableToolManager: true,
        capabilities: {
          research: {
            type: CapabilityType.KNOWLEDGE_PROCESSING,
            accessMode: AccessMode.READ_WRITE,
            description: 'Can research topics and collect information'
          }
        },
        memoryConfig: {
          enableMemoryIsolation: true
        }
      }
    });
    
    // Initialize writing agent
    writingAgent = await agentFactory.createAgent({
      agentId: 'writing-agent-' + Date.now(),
      config: {
        enableMemoryManager: true,
        enableOutputProcessor: true,
        capabilities: {
          writing: {
            type: CapabilityType.CONTENT_GENERATION,
            accessMode: AccessMode.READ_WRITE,
            description: 'Can write and edit content'
          }
        },
        memoryConfig: {
          enableMemoryIsolation: true
        }
      }
    });
    
    // Initialize coordinator agent
    coordinatorAgent = await agentFactory.createAgent({
      agentId: 'coordinator-agent-' + Date.now(),
      config: {
        enableMemoryManager: true,
        enableSchedulerManager: true,
        enablePlanningManager: true,
        capabilities: {
          coordination: {
            type: CapabilityType.TASK_MANAGEMENT,
            accessMode: AccessMode.READ_WRITE,
            description: 'Can coordinate tasks between agents'
          }
        },
        memoryConfig: {
          enableMemoryIsolation: true
        }
      }
    });
  });
  
  // Cleanup after all tests
  afterAll(async () => {
    if (researchAgent) await researchAgent.shutdown();
    if (writingAgent) await writingAgent.shutdown();
    if (coordinatorAgent) await coordinatorAgent.shutdown();
  });
  
  // Agent messaging test
  test('Should send and receive messages between agents', async () => {
    // Create secure channel between agents
    const channelId = await coordinatorAgent.createSecureChannel([
      researchAgent.getAgentId(),
      writingAgent.getAgentId()
    ]);
    
    expect(channelId).toBeDefined();
    
    // Send message from coordinator to research agent
    const messageId = await coordinatorAgent.sendMessage({
      recipientId: researchAgent.getAgentId(),
      type: MessageType.COMMAND,
      priority: MessagePriority.HIGH,
      content: 'Research quantum computing basics',
      metadata: {
        taskId: 'task-123',
        channelId: channelId
      }
    });
    
    // Verify message was sent
    expect(messageId).toBeDefined();
    
    // Receive message in research agent
    const messages = await researchAgent.getMessages({
      status: MessageStatus.UNREAD
    });
    
    // Verify message receipt
    expect(messages.length).toBeGreaterThan(0);
    const receivedMessage = messages.find(m => m.id === messageId);
    expect(receivedMessage).toBeDefined();
    expect(receivedMessage.content).toBe('Research quantum computing basics');
    expect(receivedMessage.senderId).toBe(coordinatorAgent.getAgentId());
    
    // Mark message as read
    await researchAgent.updateMessageStatus(messageId, MessageStatus.READ);
    
    // Send response message
    const responseId = await researchAgent.sendMessage({
      recipientId: coordinatorAgent.getAgentId(),
      type: MessageType.RESPONSE,
      priority: MessagePriority.NORMAL,
      content: 'Completed research on quantum computing basics',
      metadata: {
        replyToMessageId: messageId,
        taskId: 'task-123',
        channelId: channelId
      }
    });
    
    // Verify coordinator received the response
    const responses = await coordinatorAgent.getMessages({
      status: MessageStatus.UNREAD
    });
    
    const receivedResponse = responses.find(m => m.id === responseId);
    expect(receivedResponse).toBeDefined();
    expect(receivedResponse.content).toContain('Completed research');
    expect(receivedResponse.metadata.replyToMessageId).toBe(messageId);
  });
  
  // Capability discovery test
  test('Should discover capabilities between agents', async () => {
    // Get capabilities from research agent
    const researchCapabilities = await coordinatorAgent.discoverCapabilities(researchAgent.getAgentId());
    
    // Verify research capabilities
    expect(researchCapabilities).toBeDefined();
    expect(researchCapabilities.research).toBeDefined();
    expect(researchCapabilities.research.type).toBe(CapabilityType.KNOWLEDGE_PROCESSING);
    expect(researchCapabilities.research.description).toContain('research topics');
    
    // Get capabilities from writing agent
    const writingCapabilities = await coordinatorAgent.discoverCapabilities(writingAgent.getAgentId());
    
    // Verify writing capabilities
    expect(writingCapabilities).toBeDefined();
    expect(writingCapabilities.writing).toBeDefined();
    expect(writingCapabilities.writing.type).toBe(CapabilityType.CONTENT_GENERATION);
    expect(writingCapabilities.writing.description).toContain('write and edit');
  });
  
  // Collaborative task execution test
  test('Should execute collaborative tasks across agents', async () => {
    // Create a collaborative task
    const taskId = await coordinatorAgent.createTask({
      title: 'Create quantum computing article',
      description: 'Research quantum computing and write an article about it',
      steps: [
        {
          agentId: researchAgent.getAgentId(),
          action: 'research',
          parameters: { topic: 'quantum computing' },
          output: { format: 'research_notes' }
        },
        {
          agentId: writingAgent.getAgentId(),
          action: 'write',
          parameters: { topic: 'quantum computing', style: 'educational' },
          input: { format: 'research_notes' },
          output: { format: 'article' }
        }
      ]
    });
    
    // Verify task creation
    expect(taskId).toBeDefined();
    
    // Create shared workspace for the task
    const workspaceId = await coordinatorAgent.createSharedWorkspace({
      taskId: taskId,
      participants: [
        researchAgent.getAgentId(),
        writingAgent.getAgentId()
      ]
    });
    
    // Verify workspace creation
    expect(workspaceId).toBeDefined();
    
    // Research agent adds research to workspace
    const researchData = { 
      title: 'Quantum Computing Basics',
      sections: [
        { title: 'Quantum Bits', content: 'Quantum bits or qubits are the basic units...' },
        { title: 'Quantum Gates', content: 'Quantum gates manipulate qubits to perform...' }
      ]
    };
    
    await researchAgent.addToWorkspace(workspaceId, 'research_notes', researchData);
    
    // Verify data is accessible to writing agent
    const retrievedData = await writingAgent.getFromWorkspace(workspaceId, 'research_notes');
    
    expect(retrievedData).toBeDefined();
    expect(retrievedData.title).toBe('Quantum Computing Basics');
    expect(retrievedData.sections.length).toBe(2);
    
    // Writing agent adds article to workspace
    const articleData = {
      title: 'Understanding Quantum Computing',
      content: 'Quantum computing is an emerging technology that uses quantum mechanics...',
      sections: [
        { title: 'What are Qubits?', content: 'Quantum bits or qubits are the basic units...' },
        { title: 'How Quantum Gates Work', content: 'Quantum gates manipulate qubits to perform...' }
      ]
    };
    
    await writingAgent.addToWorkspace(workspaceId, 'article', articleData);
    
    // Coordinator agent checks task completion
    const taskResult = await coordinatorAgent.getWorkspaceOutput(workspaceId, 'article');
    
    // Verify final article
    expect(taskResult).toBeDefined();
    expect(taskResult.title).toBe('Understanding Quantum Computing');
    expect(taskResult.sections.length).toBe(2);
    
    // Mark task as complete
    await coordinatorAgent.updateTaskStatus(taskId, 'COMPLETED');
    
    // Clean up
    await coordinatorAgent.deleteWorkspace(workspaceId);
    await coordinatorAgent.deleteTask(taskId);
  });
  
  // Permission management test
  test('Should manage permissions between agents correctly', async () => {
    // Create private resource in research agent
    const resourceId = await researchAgent.createResource({
      type: 'research_data',
      content: 'Proprietary quantum research data',
      accessControl: { isPrivate: true }
    });
    
    // Try to access without permission
    try {
      await writingAgent.getResource(researchAgent.getAgentId(), resourceId);
      fail('Should not be able to access private resource without permission');
    } catch (error) {
      expect(error).toBeDefined();
    }
    
    // Request access permission
    const requestId = await writingAgent.requestPermission({
      resourceOwner: researchAgent.getAgentId(),
      resourceId: resourceId,
      accessType: 'READ',
      reason: 'Need research data for article writing'
    });
    
    expect(requestId).toBeDefined();
    
    // Grant permission
    await researchAgent.grantPermission({
      requestId: requestId,
      accessType: 'READ',
      timeLimit: 3600, // 1 hour
      constraints: { 
        usage: 'article_writing_only',
        noSharing: true
      }
    });
    
    // Access with permission
    const resource = await writingAgent.getResource(researchAgent.getAgentId(), resourceId);
    
    // Verify resource access
    expect(resource).toBeDefined();
    expect(resource.content).toBe('Proprietary quantum research data');
    expect(resource.accessControl.constraints.usage).toBe('article_writing_only');
    
    // Try to modify (should fail as only READ was granted)
    try {
      await writingAgent.updateResource(researchAgent.getAgentId(), resourceId, {
        content: 'Modified research data'
      });
      fail('Should not be able to modify with only READ permission');
    } catch (error) {
      expect(error).toBeDefined();
    }
    
    // Clean up
    await researchAgent.deleteResource(resourceId);
  });
}); 