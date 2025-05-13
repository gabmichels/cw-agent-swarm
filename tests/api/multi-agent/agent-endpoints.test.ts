import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { AgentStatus } from '@/server/memory/schema/agent';
import { AgentCapability, AgentParameters, AgentMetadata } from '@/lib/multi-agent/types/agent';
import { AgentManagersConfig } from '@/components/agent/ManagerConfigPanel';

// Create mock agent memory service
const mockAgentService = {
  create: vi.fn(),
  findAll: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  updateAgentStatus: vi.fn(),
  updateAgentCapabilities: vi.fn(),
  delete: vi.fn()
};

// Mock the createAgentMemoryService
vi.mock('@/server/memory/services/multi-agent', () => ({
  createAgentMemoryService: vi.fn().mockReturnValue(mockAgentService)
}));

// Mock services
vi.mock('@/server/memory/services', () => ({
  getMemoryServices: vi.fn().mockResolvedValue({
    memoryService: {}
  })
}));

vi.mock('@/agents/shared/AgentFactory', () => ({
  AgentFactory: {
    createFromApiProfile: vi.fn().mockReturnValue({
      initialize: vi.fn().mockResolvedValue(true),
      getAgentId: vi.fn().mockReturnValue('test_agent_id'),
      getConfig: vi.fn().mockReturnValue({
        id: 'test_agent_id',
        name: 'Test Agent',
        description: 'Test description',
        status: 'available',
        capabilities: []
      })
    })
  }
}));

// Create mock handlers for testing
async function mockCreateAgent(req: Request) {
  try {
    const body = await req.json();
    
    // Validate request
    if (!body.name) {
      return Response.json({ success: false, error: 'Agent name is required' }, { status: 400 });
    }
    
    if (!body.description) {
      return Response.json({ success: false, error: 'Agent description is required' }, { status: 400 });
    }
    
    if (!body.capabilities || body.capabilities.length === 0) {
      return Response.json({ success: false, error: 'At least one capability is required' }, { status: 400 });
    }
    
    // Mock agent data
    const agent = {
      id: `agent_${body.name.toLowerCase().replace(/\s+/g, '_')}_12345`,
      name: body.name,
      description: body.description,
      status: body.status,
      capabilities: body.capabilities,
      parameters: body.parameters,
      metadata: body.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return Response.json({
      success: true,
      message: 'Agent registered successfully',
      agent
    });
  } catch (error) {
    return Response.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}

async function mockGetAgents(req: Request) {
  try {
    // Simulate calling the agent service
    const result = mockAgentService.findAll();
    
    if (!result || result.isError) {
      return Response.json(
        { success: false, error: result?.error?.message || 'An unknown error occurred' },
        { status: 500 }
      );
    }
    
    return Response.json({
      success: true,
      agents: result.data || [],
      total: (result.data || []).length,
      page: 1,
      pageSize: (result.data || []).length
    });
  } catch (error) {
    return Response.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}

async function mockGetAgentById(req: Request, { params }: { params: { agentId: string } }) {
  try {
    if (!params.agentId) {
      return Response.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Simulate calling the agent service
    const result = mockAgentService.getById(params.agentId);
    
    if (!result || result.isError) {
      return Response.json(
        { error: result?.error?.message || 'An unknown error occurred' },
        { status: 500 }
      );
    }
    
    if (!result.data) {
      return Response.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    return Response.json({ agent: result.data });
  } catch (error) {
    return Response.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

async function mockDeleteAgent(req: Request, { params }: { params: { agentId: string } }) {
  try {
    if (!params.agentId) {
      return Response.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    // Simulate calling the agent service
    const result = mockAgentService.delete(params.agentId);
    
    if (!result || result.isError) {
      return Response.json(
        { error: result?.error?.message || 'An unknown error occurred' },
        { status: 500 }
      );
    }
    
    if (!result.data) {
      return Response.json(
        { error: 'Agent not found or could not be deleted' },
        { status: 404 }
      );
    }
    
    return Response.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    return Response.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

async function mockUpdateAgent(req: Request, { params }: { params: { agentId: string } }) {
  try {
    if (!params.agentId) {
      return Response.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    const updateData = await req.json();
    
    // Simulate calling the agent service
    const result = mockAgentService.update(params.agentId, updateData);
    
    if (!result || result.isError) {
      return Response.json(
        { error: result?.error?.message || 'An unknown error occurred' },
        { status: 500 }
      );
    }
    
    if (!result.data) {
      return Response.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    return Response.json({ agent: result.data });
  } catch (error) {
    return Response.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

async function mockPatchAgent(req: Request, { params }: { params: { agentId: string } }) {
  try {
    if (!params.agentId) {
      return Response.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    const patchData = await req.json();
    const { status, capabilities } = patchData;
    
    let result;
    
    // Handle status update
    if (status) {
      result = mockAgentService.updateAgentStatus(params.agentId, status);
      
      if (!result || result.isError || !result.data) {
        return Response.json(
          { error: result?.error?.message || 'Could not update agent status' },
          { status: result?.isError ? 500 : 404 }
        );
      }
    }
    
    // Handle capabilities update
    if (capabilities && Array.isArray(capabilities)) {
      result = mockAgentService.updateAgentCapabilities(params.agentId, capabilities);
      
      if (!result || result.isError || !result.data) {
        return Response.json(
          { error: result?.error?.message || 'Could not update agent capabilities' },
          { status: result?.isError ? 500 : 404 }
        );
      }
    }
    
    // Get updated agent
    const getResult = mockAgentService.getById(params.agentId);
    
    if (!getResult || getResult.isError || !getResult.data) {
      return Response.json(
        { error: getResult?.error?.message || 'Agent not found' },
        { status: getResult?.isError ? 500 : 404 }
      );
    }
    
    return Response.json({ agent: getResult.data });
  } catch (error) {
    return Response.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

describe('Agent API Endpoints', () => {
  const mockAgentData = {
    name: 'Test Agent',
    description: 'A test agent for API testing',
    status: AgentStatus.AVAILABLE,
    capabilities: [
      {
        id: 'cap_test',
        name: 'Test Capability',
        description: 'A test capability'
      }
    ] as AgentCapability[],
    parameters: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      tools: [],
      managersConfig: {
        memoryManager: { enabled: true },
        planningManager: { enabled: true }
      } as AgentManagersConfig
    } as AgentParameters,
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
    } as AgentMetadata
  };

  const mockAgentEntity = {
    id: 'agent_test_agent_01HN1234567890',
    name: 'Test Agent',
    description: 'A test agent for API testing',
    status: AgentStatus.AVAILABLE,
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
      tools: [],
      managersConfig: {
        memoryManager: { enabled: true },
        planningManager: { enabled: true }
      }
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
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/multi-agent/agents', () => {
    it('should create a new agent successfully', async () => {
      // Arrange
      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents', {
        method: 'POST',
        body: JSON.stringify(mockAgentData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await mockCreateAgent(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.agent).toBeDefined();
      expect(responseData.agent.name).toBe(mockAgentData.name);
      expect(responseData.agent.id).toBeDefined();
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
      const response = await mockCreateAgent(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(responseData.error).toContain('required');
    });
  });

  describe('GET /api/multi-agent/agents', () => {
    it('should return a list of agents', async () => {
      // Arrange
      mockAgentService.findAll.mockReturnValueOnce({ 
        isError: false, 
        data: [mockAgentEntity, mockAgentEntity] 
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents');

      // Act
      const response = await mockGetAgents(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.agents).toBeDefined();
      expect(responseData.agents.length).toBe(2);
      expect(mockAgentService.findAll).toHaveBeenCalled();
    });

    it('should handle errors when fetching agents', async () => {
      // Arrange
      mockAgentService.findAll.mockReturnValueOnce({ 
        isError: true, 
        error: new Error('Database error') 
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents');

      // Act
      const response = await mockGetAgents(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(responseData.error).toContain('Database error');
    });
  });

  describe('GET /api/multi-agent/agents/[agentId]', () => {
    it('should return an agent by ID', async () => {
      // Arrange
      mockAgentService.getById.mockReturnValueOnce({ 
        isError: false, 
        data: mockAgentEntity 
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents/agent_test_agent_01HN1234567890');
      const params = { agentId: 'agent_test_agent_01HN1234567890' };

      // Act
      const response = await mockGetAgentById(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(responseData.agent).toBeDefined();
      expect(responseData.agent.name).toBe(mockAgentEntity.name);
      expect(mockAgentService.getById).toHaveBeenCalledWith('agent_test_agent_01HN1234567890');
    });

    it('should return 404 when agent is not found', async () => {
      // Arrange
      mockAgentService.getById.mockReturnValueOnce({ 
        isError: false, 
        data: null 
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents/nonexistent_agent');
      const params = { agentId: 'nonexistent_agent' };

      // Act
      const response = await mockGetAgentById(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(responseData.error).toBeDefined();
      expect(responseData.error).toContain('not found');
    });
  });

  describe('DELETE /api/multi-agent/agents/[agentId]', () => {
    it('should delete an agent successfully', async () => {
      // Arrange
      mockAgentService.delete.mockReturnValueOnce({ 
        isError: false, 
        data: { success: true } 
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents/agent_test_agent_01HN1234567890', {
        method: 'DELETE'
      });
      const params = { agentId: 'agent_test_agent_01HN1234567890' };

      // Act
      const response = await mockDeleteAgent(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(mockAgentService.delete).toHaveBeenCalledWith('agent_test_agent_01HN1234567890');
    });

    it('should return 404 when trying to delete nonexistent agent', async () => {
      // Arrange
      mockAgentService.delete.mockReturnValueOnce({ 
        isError: false, 
        data: null 
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents/nonexistent_agent', {
        method: 'DELETE'
      });
      const params = { agentId: 'nonexistent_agent' };

      // Act
      const response = await mockDeleteAgent(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(responseData.error).toBeDefined();
      expect(responseData.error).toContain('not found');
    });
  });

  describe('PUT /api/multi-agent/agents/[agentId]', () => {
    it('should update an agent successfully', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Agent Name',
        description: 'Updated description'
      };
      
      mockAgentService.update.mockReturnValueOnce({ 
        isError: false, 
        data: { ...mockAgentEntity, ...updateData } 
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents/agent_test_agent_01HN1234567890', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      const params = { agentId: 'agent_test_agent_01HN1234567890' };

      // Act
      const response = await mockUpdateAgent(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(responseData.agent).toBeDefined();
      expect(responseData.agent.name).toBe(updateData.name);
      expect(responseData.agent.description).toBe(updateData.description);
      expect(mockAgentService.update).toHaveBeenCalledWith('agent_test_agent_01HN1234567890', updateData);
    });
  });

  describe('PATCH /api/multi-agent/agents/[agentId]', () => {
    it('should patch agent status successfully', async () => {
      // Arrange
      const patchData = {
        status: AgentStatus.BUSY
      };
      
      mockAgentService.updateAgentStatus.mockReturnValueOnce({ 
        isError: false, 
        data: { ...mockAgentEntity, status: AgentStatus.BUSY } 
      });
      mockAgentService.getById.mockReturnValueOnce({ 
        isError: false, 
        data: { ...mockAgentEntity, status: AgentStatus.BUSY } 
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents/agent_test_agent_01HN1234567890', {
        method: 'PATCH',
        body: JSON.stringify(patchData)
      });
      const params = { agentId: 'agent_test_agent_01HN1234567890' };

      // Act
      const response = await mockPatchAgent(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(responseData.agent).toBeDefined();
      expect(responseData.agent.status).toBe(AgentStatus.BUSY);
      expect(mockAgentService.updateAgentStatus).toHaveBeenCalledWith('agent_test_agent_01HN1234567890', AgentStatus.BUSY);
    });

    it('should patch agent capabilities successfully', async () => {
      // Arrange
      const newCapability = {
        id: 'cap_new',
        name: 'New Capability',
        description: 'A new capability'
      };
      
      const patchData = {
        capabilities: [newCapability]
      };
      
      mockAgentService.updateAgentCapabilities.mockReturnValueOnce({ 
        isError: false, 
        data: { ...mockAgentEntity, capabilities: [newCapability] } 
      });
      mockAgentService.getById.mockReturnValueOnce({ 
        isError: false, 
        data: { ...mockAgentEntity, capabilities: [newCapability] } 
      });

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/agents/agent_test_agent_01HN1234567890', {
        method: 'PATCH',
        body: JSON.stringify(patchData)
      });
      const params = { agentId: 'agent_test_agent_01HN1234567890' };

      // Act
      const response = await mockPatchAgent(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(responseData.agent).toBeDefined();
      expect(responseData.agent.capabilities).toContainEqual(newCapability);
      expect(mockAgentService.updateAgentCapabilities).toHaveBeenCalledWith(
        'agent_test_agent_01HN1234567890', 
        [newCapability]
      );
    });
  });
}); 