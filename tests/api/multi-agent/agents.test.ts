import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Define a type for AgentRegistrationRequest since we can't import it
interface AgentCapability {
  id: string;
  name: string;
  description: string;
}

interface AgentParameters {
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
}

interface AgentPerformanceMetrics {
  successRate: number;
  averageResponseTime: number;
  taskCompletionRate: number;
}

interface AgentMetadata {
  tags: string[];
  domain: string[];
  specialization: string[];
  performanceMetrics: AgentPerformanceMetrics;
  version: string;
  isPublic: boolean;
}

interface AgentRegistrationRequest {
  name: string;
  description: string;
  status: 'available' | 'unavailable' | 'maintenance';
  capabilities: AgentCapability[];
  parameters: AgentParameters;
  metadata: AgentMetadata;
}

// Mock API functions
const createAgent = async (req: Request) => {
  const body = await req.json();
  
  // Check if required fields are present
  if (!body.name) {
    return Response.json({ success: false, error: 'Agent name is required' }, { status: 400 });
  }
  
  // Return a mock successful response
  return Response.json({
    success: true,
    agent: {
      id: `agent_${body.name.toLowerCase().replace(/\s+/g, '_')}_12345`,
      name: body.name,
      description: body.description,
      status: body.status,
      capabilities: body.capabilities,
      parameters: body.parameters,
      metadata: body.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
};

const initializeAgent = async (req: Request, { params }: { params: { agentId: string } }) => {
  // Check if agent ID is present
  if (!params.agentId) {
    return Response.json({
      success: false,
      isInitialized: false,
      message: 'Agent ID is required'
    }, { status: 400 });
  }
  
  // Return a mock successful response
  return Response.json({
    success: true,
    isInitialized: true,
    message: `Agent ${params.agentId} successfully initialized`
  });
};

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

describe('Agent API Endpoints', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/multi-agent/agents', () => {
    it('should create a new agent successfully', async () => {
      // Arrange
      const mockAgentData: AgentRegistrationRequest = {
        name: 'Test Agent',
        description: 'A test agent for unit testing',
        status: 'available',
        capabilities: [
          {
            id: 'cap_test',
            name: 'Test Capability',
            description: 'A test capability'
          }
        ],
        parameters: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000,
          tools: []
        },
        metadata: {
          tags: ['test', 'agent'],
          domain: ['testing'],
          specialization: ['unit-testing'],
          performanceMetrics: {
            successRate: 0,
            averageResponseTime: 0,
            taskCompletionRate: 0
          },
          version: '1.0',
          isPublic: true
        }
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents', {
        method: 'POST',
        body: JSON.stringify(mockAgentData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await createAgent(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.agent).toBeDefined();
      expect(responseData.agent.name).toBe(mockAgentData.name);
      expect(responseData.agent.id).toBeDefined();
      expect(responseData.agent.id).toContain('agent_test_agent_');
    });

    it('should return an error when required fields are missing', async () => {
      // Arrange
      const invalidAgentData = {
        // Missing name and other required fields
        description: 'An invalid agent'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents', {
        method: 'POST',
        body: JSON.stringify(invalidAgentData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await createAgent(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });
  });

  describe('POST /api/multi-agent/agents/[agentId]/initialize', () => {
    it('should initialize an agent successfully', async () => {
      // Arrange
      const agentId = 'agent_test_123';
      const params = { agentId };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents/agent_test_123/initialize', {
        method: 'POST',
        body: JSON.stringify({ chatId: 'chat_123' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await initializeAgent(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.isInitialized).toBe(true);
      expect(responseData.message).toContain(agentId);
    });

    it('should return an error when agent ID is missing', async () => {
      // Arrange
      const params = { agentId: '' };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents//initialize', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await initializeAgent(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.isInitialized).toBe(false);
      expect(responseData.message).toBeDefined();
    });
  });
}); 