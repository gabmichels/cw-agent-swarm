import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getAgents, POST as createAgent } from '../src/app/api/multi-agent/system/agents/route';
import { GET as getAgent, PUT as updateAgent, DELETE as deleteAgent, PATCH as patchAgent } from '../src/app/api/multi-agent/system/agents/[agentId]/route';

// Mock the agent memory service
vi.mock('../src/server/memory/services/multi-agent', () => {
  let mockAgents = new Map();
  
  // Setup initial test agent
  const testAgent = {
    id: 'test-agent-id',
    name: 'Test Agent',
    description: 'Test agent description',
    capabilities: [
      {
        id: 'test-capability',
        name: 'Test Capability',
        description: 'Test capability description',
        version: '1.0.0'
      }
    ],
    status: 'available',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };
  
  mockAgents.set('test-agent-id', testAgent);
  
  return {
    createAgentMemoryService: vi.fn(() => Promise.resolve({
      getById: vi.fn((id) => Promise.resolve({
        isError: false,
        data: mockAgents.get(id) || null
      })),
      getAll: vi.fn(() => Promise.resolve({
        isError: false,
        data: Array.from(mockAgents.values())
      })),
      findAgentsByCapability: vi.fn((capability) => Promise.resolve({
        isError: false,
        data: Array.from(mockAgents.values()).filter(agent => 
          agent.capabilities.some((cap: any) => cap.id === capability)
        )
      })),
      findAvailableAgents: vi.fn(() => Promise.resolve({
        isError: false,
        data: Array.from(mockAgents.values()).filter(agent => agent.status === 'available')
      })),
      create: vi.fn((data) => {
        const newId = data.id || `agent-${Date.now()}`;
        const newAgent = { 
          ...data,
          id: newId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockAgents.set(newId, newAgent);
        return Promise.resolve({
          isError: false,
          data: newAgent
        });
      }),
      update: vi.fn((id, data) => {
        const agent = mockAgents.get(id);
        if (!agent) return Promise.resolve({ isError: true, data: null, message: 'Agent not found' });
        
        const updatedAgent = { 
          ...agent, 
          ...data, 
          updatedAt: new Date().toISOString() 
        };
        mockAgents.set(id, updatedAgent);
        return Promise.resolve({
          isError: false,
          data: updatedAgent
        });
      }),
      delete: vi.fn((id) => {
        if (!mockAgents.has(id)) return Promise.resolve({ isError: true, data: false, message: 'Agent not found' });
        mockAgents.delete(id);
        return Promise.resolve({
          isError: false,
          data: true
        });
      }),
      updateAgentStatus: vi.fn((id, status) => {
        const agent = mockAgents.get(id);
        if (!agent) return Promise.resolve({ isError: true, data: null, message: 'Agent not found' });
        
        const updatedAgent = {
          ...agent,
          status,
          updatedAt: new Date().toISOString()
        };
        mockAgents.set(id, updatedAgent);
        return Promise.resolve({
          isError: false,
          data: updatedAgent
        });
      }),
      updateAgentCapabilities: vi.fn((id, capabilities) => {
        const agent = mockAgents.get(id);
        if (!agent) return Promise.resolve({ isError: true, data: null, message: 'Agent not found' });
        
        const updatedAgent = {
          ...agent,
          capabilities,
          updatedAt: new Date().toISOString()
        };
        mockAgents.set(id, updatedAgent);
        return Promise.resolve({
          isError: false,
          data: updatedAgent
        });
      })
    }))
  };
});

// Helper function to create mock request
function createMockRequest(method: string, url: string, body: any = null): NextRequest {
  const request = {
    method,
    url,
    headers: new Headers({
      'Content-Type': 'application/json'
    }),
    json: () => Promise.resolve(body),
    nextUrl: new URL(url)
  } as unknown as NextRequest;
  
  return request;
}

describe('Agent Management API Tests', () => {
  describe('GET /api/multi-agent/system/agents', () => {
    test('should return all agents', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/agents');
      const response = await getAgents(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('agents');
      expect(Array.isArray(data.agents)).toBe(true);
      expect(data.agents.length).toBeGreaterThan(0);
      expect(data.agents[0]).toHaveProperty('id', 'test-agent-id');
    });
    
    test('should get a specific agent by ID from query param', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/agents?agentId=test-agent-id');
      const response = await getAgents(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('agent');
      expect(data.agent).toHaveProperty('id', 'test-agent-id');
    });
    
    test('should return 404 for non-existent agent ID in query param', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/agents?agentId=non-existent');
      const response = await getAgents(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Agent not found');
    });
    
    test('should filter agents by capability', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/agents?capability=test-capability');
      const response = await getAgents(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('agents');
      expect(Array.isArray(data.agents)).toBe(true);
    });
    
    test('should filter agents by available status', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/agents?status=available');
      const response = await getAgents(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('agents');
      expect(Array.isArray(data.agents)).toBe(true);
    });
  });
  
  describe('POST /api/multi-agent/system/agents', () => {
    test('should create a new agent', async () => {
      const agentData = {
        name: 'New Agent',
        description: 'New agent description',
        capabilities: [
          {
            id: 'new-capability',
            name: 'New Capability',
            description: 'New capability description',
            version: '1.0.0'
          }
        ],
        parameters: {
          model: 'gpt-4',
          temperature: 0.7
        }
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/agents', agentData);
      const response = await createAgent(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data).toHaveProperty('agent');
      expect(data.agent).toHaveProperty('name', 'New Agent');
      expect(data.agent).toHaveProperty('id');
      expect(data.agent).toHaveProperty('capabilities');
      expect(data.agent.capabilities[0].id).toBe('new-capability');
    });
    
    test('should return 400 if required fields are missing', async () => {
      const agentData = {
        description: 'Missing name'
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/agents', agentData);
      const response = await createAgent(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });
  
  describe('GET /api/multi-agent/system/agents/[agentId]', () => {
    test('should return agent details', async () => {
      const params = { agentId: 'test-agent-id' };
      const request = createMockRequest('GET', `http://localhost/api/multi-agent/system/agents/test-agent-id`);
      const response = await getAgent(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('agent');
      expect(data.agent).toHaveProperty('id', 'test-agent-id');
      expect(data.agent).toHaveProperty('name', 'Test Agent');
      expect(data.agent).toHaveProperty('capabilities');
    });
    
    test('should return 404 if agent not found', async () => {
      const params = { agentId: 'non-existent-agent' };
      const request = createMockRequest('GET', `http://localhost/api/multi-agent/system/agents/non-existent-agent`);
      const response = await getAgent(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Agent not found');
    });
  });
  
  describe('PUT /api/multi-agent/system/agents/[agentId]', () => {
    test('should update an agent', async () => {
      const params = { agentId: 'test-agent-id' };
      const updateData = {
        name: 'Updated Agent',
        description: 'Updated description',
        capabilities: [
          {
            id: 'updated-capability',
            name: 'Updated Capability',
            description: 'Updated capability description',
            version: '1.1.0'
          }
        ]
      };
      
      const request = createMockRequest('PUT', `http://localhost/api/multi-agent/system/agents/test-agent-id`, updateData);
      const response = await updateAgent(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('agent');
      expect(data.agent).toHaveProperty('name', 'Updated Agent');
      expect(data.agent).toHaveProperty('description', 'Updated description');
      expect(data.agent.capabilities[0].id).toBe('updated-capability');
    });
    
    test('should return 404 if agent not found', async () => {
      const params = { agentId: 'non-existent-agent' };
      const updateData = {
        name: 'Updated Agent'
      };
      
      const request = createMockRequest('PUT', `http://localhost/api/multi-agent/system/agents/non-existent-agent`, updateData);
      const response = await updateAgent(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Agent not found');
    });
  });
  
  describe('PATCH /api/multi-agent/system/agents/[agentId]', () => {
    test('should partially update an agent status', async () => {
      const params = { agentId: 'test-agent-id' };
      const patchData = {
        status: 'busy'
      };
      
      const request = createMockRequest('PATCH', `http://localhost/api/multi-agent/system/agents/test-agent-id`, patchData);
      const response = await patchAgent(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('agent');
      expect(data.agent).toHaveProperty('status', 'busy');
    });
    
    test('should partially update agent capabilities', async () => {
      const params = { agentId: 'test-agent-id' };
      const patchData = {
        capabilities: [
          {
            id: 'patched-capability',
            name: 'Patched Capability',
            description: 'Patched capability description',
            version: '1.0.0'
          }
        ]
      };
      
      const request = createMockRequest('PATCH', `http://localhost/api/multi-agent/system/agents/test-agent-id`, patchData);
      const response = await patchAgent(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('agent');
      expect(data.agent.capabilities[0].id).toBe('patched-capability');
    });
    
    test('should return 404 if agent not found', async () => {
      const params = { agentId: 'non-existent-agent' };
      const patchData = {
        status: 'busy'
      };
      
      const request = createMockRequest('PATCH', `http://localhost/api/multi-agent/system/agents/non-existent-agent`, patchData);
      const response = await patchAgent(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Agent not found');
    });
  });
  
  describe('DELETE /api/multi-agent/system/agents/[agentId]', () => {
    test('should delete an agent', async () => {
      const params = { agentId: 'test-agent-id' };
      const request = createMockRequest('DELETE', `http://localhost/api/multi-agent/system/agents/test-agent-id`);
      const response = await deleteAgent(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Agent deleted successfully');
    });
    
    test('should return 404 if agent not found', async () => {
      const params = { agentId: 'non-existent-agent' };
      const request = createMockRequest('DELETE', `http://localhost/api/multi-agent/system/agents/non-existent-agent`);
      const response = await deleteAgent(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Agent not found');
    });
  });
}); 