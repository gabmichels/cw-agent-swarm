/**
 * Security Trust Service Tests
 * 
 * This file contains tests for the SecurityTrustService, testing authentication,
 * authorization, trust relationships, and security policies.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SecurityTrustService } from '../security-trust-service';
import { 
  AuthenticationMethod, 
  TrustLevel,
  AuthenticationResult,
  AuthorizationResult,
  TrustRelationship,
  SecurityPolicy
} from '../security-trust-interface';
import { AnyMemoryService } from '../../../../memory/memory-service-wrappers';
import { MemoryType } from '../../../../../config';

// Mock memory types for security components
const MEMORY_TYPE = {
  TRUST_RELATIONSHIP: 'trust_relationship' as unknown as MemoryType,
  SECURITY_POLICY: 'security_policy' as unknown as MemoryType,
  AGENT_SECURITY: 'agent_security' as unknown as MemoryType,
  AUTH_TOKEN: 'auth_token' as unknown as MemoryType
};

// Mock memory service
const mockAddMemory = vi.fn().mockResolvedValue({ success: true, id: 'mock-memory-id' });
const mockSearchMemories = vi.fn().mockImplementation((params) => {
  console.log('MOCK searchMemories called with params:', JSON.stringify(params));
  return [];
});
const mockUpdateMemory = vi.fn().mockResolvedValue(true);
const mockDeleteMemory = vi.fn().mockResolvedValue(true);

const mockMemoryService = {
  addMemory: mockAddMemory,
  searchMemories: mockSearchMemories,
  updateMemory: mockUpdateMemory,
  deleteMemory: mockDeleteMemory
} as unknown as AnyMemoryService;

// Test data
const TEST_AGENT_ID = 'agent-123';
const TEST_TARGET_AGENT_ID = 'agent-456';

describe('SecurityTrustService', () => {
  let securityTrustService: SecurityTrustService;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create a new instance of the service
    securityTrustService = new SecurityTrustService(mockMemoryService);
    
    // Mock Date.now to return a consistent timestamp
    vi.spyOn(Date, 'now').mockImplementation(() => 1234567890);
    
    // Mock crypto.randomUUID if used in the implementation
    if (global.crypto) {
      vi.spyOn(global.crypto, 'randomUUID').mockImplementation(() => 'mock-uuid');
    }
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('authenticateAgent', () => {
    it('should return unauthenticated result when agent security info not found', async () => {
      // Mock empty result for agent security info
      mockSearchMemories.mockResolvedValueOnce([]);
      
      const result = await securityTrustService.authenticateAgent(
        TEST_AGENT_ID,
        { apiKey: 'test-key' },
        AuthenticationMethod.API_KEY
      );
      
      expect(result.isAuthenticated).toBe(false);
      expect(result.agentId).toBe(TEST_AGENT_ID);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].code).toBe('AGENT_NOT_FOUND');
    });
    
    it('should return unauthenticated result when auth method not allowed', async () => {
      // Mock agent security info with only JWT allowed
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_AGENT_ID,
            allowedAuthMethods: [AuthenticationMethod.JWT],
            appliedPolicies: []
          }
        }
      }]);
      
      const result = await securityTrustService.authenticateAgent(
        TEST_AGENT_ID,
        { apiKey: 'test-key' },
        AuthenticationMethod.API_KEY
      );
      
      expect(result.isAuthenticated).toBe(false);
      expect(result.errors?.[0].code).toBe('AUTH_METHOD_NOT_ALLOWED');
    });
    
    it('should authenticate with valid API key', async () => {
      // Mock agent security info with API_KEY allowed
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_AGENT_ID,
            allowedAuthMethods: [AuthenticationMethod.API_KEY],
            appliedPolicies: []
          }
        }
      }]);
      
      // Valid API key format from the implementation
      const result = await securityTrustService.authenticateAgent(
        TEST_AGENT_ID,
        { apiKey: `agent_${TEST_AGENT_ID}_key` },
        AuthenticationMethod.API_KEY
      );
      
      expect(result.isAuthenticated).toBe(true);
      expect(result.agentId).toBe(TEST_AGENT_ID);
      expect(result.authMethod).toBe(AuthenticationMethod.API_KEY);
      expect(result.expiresAt).toBeDefined();
      expect(mockAddMemory).toHaveBeenCalledTimes(1);
    });
    
    it('should authenticate with valid JWT', async () => {
      // Mock agent security info with JWT allowed
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_AGENT_ID,
            allowedAuthMethods: [AuthenticationMethod.JWT],
            appliedPolicies: []
          }
        }
      }]);
      
      // Valid JWT format (three parts with dots)
      const result = await securityTrustService.authenticateAgent(
        TEST_AGENT_ID,
        { token: 'header.payload.signature' },
        AuthenticationMethod.JWT
      );
      
      expect(result.isAuthenticated).toBe(true);
      expect(result.authMethod).toBe(AuthenticationMethod.JWT);
    });
    
    it('should fail with invalid credentials', async () => {
      // Mock agent security info with API_KEY allowed
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_AGENT_ID,
            allowedAuthMethods: [AuthenticationMethod.API_KEY],
            appliedPolicies: []
          }
        }
      }]);
      
      // Invalid API key
      const result = await securityTrustService.authenticateAgent(
        TEST_AGENT_ID,
        { apiKey: 'invalid-key' },
        AuthenticationMethod.API_KEY
      );
      
      expect(result.isAuthenticated).toBe(false);
      expect(result.errors?.[0].code).toBe('INVALID_API_KEY');
    });
  });
  
  describe('authorizeOperation', () => {
    it('should return unauthorized result when agent security info not found', async () => {
      // Mock empty result for agent security info
      mockSearchMemories.mockResolvedValueOnce([]);
      
      const result = await securityTrustService.authorizeOperation(
        TEST_AGENT_ID,
        'read',
        'document:123'
      );
      
      expect(result.isAuthorized).toBe(false);
      expect(result.errors?.[0].code).toBe('AGENT_NOT_FOUND');
    });
    
    it('should apply default authorization rules when no policies exist', async () => {
      // Mock agent security info with no policies
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_AGENT_ID,
            appliedPolicies: [],
            allowedAuthMethods: [AuthenticationMethod.API_KEY]
          }
        }
      }]);
      
      // Test accessing own resource (should be allowed)
      const result = await securityTrustService.authorizeOperation(
        TEST_AGENT_ID,
        'read',
        `document:${TEST_AGENT_ID}`
      );
      
      expect(result.isAuthorized).toBe(true);
      expect(result.permissions).toContain('read');
    });
    
    it('should allow access to public resources', async () => {
      // Mock agent security info with no policies
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_AGENT_ID,
            appliedPolicies: [],
            allowedAuthMethods: [AuthenticationMethod.API_KEY]
          }
        }
      }]);
      
      // Test accessing public resource (should be allowed)
      const result = await securityTrustService.authorizeOperation(
        TEST_AGENT_ID,
        'read',
        'public:document123'
      );
      
      expect(result.isAuthorized).toBe(true);
    });
    
    it('should apply security policy restrictions', async () => {
      // Mock agent security info with a policy
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_AGENT_ID,
            appliedPolicies: ['policy-123'],
            allowedAuthMethods: [AuthenticationMethod.API_KEY]
          }
        }
      }]);
      
      // Mock policy retrieval
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: 'policy-123',
            name: 'Test Policy',
            isActive: true,
            requiredTrustLevel: TrustLevel.MEDIUM,
            allowedAuthMethods: [AuthenticationMethod.API_KEY],
            resourceRestrictions: [
              {
                resourceType: 'document',
                allowedOperations: ['read']
              }
            ]
          }
        }
      }]);
      
      // Test reading a document (should be allowed)
      const result = await securityTrustService.authorizeOperation(
        TEST_AGENT_ID,
        'read',
        'document:123'
      );
      
      console.log('Read operation result:', result);
      
      expect(result.isAuthorized).toBe(true);
      
      // Now test writing (should be denied)
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_AGENT_ID,
            appliedPolicies: ['policy-123'],
            allowedAuthMethods: [AuthenticationMethod.API_KEY]
          }
        }
      }]);
      
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            id: 'policy-123',
            name: 'Test Policy',
            isActive: true,
            requiredTrustLevel: TrustLevel.MEDIUM,
            allowedAuthMethods: [AuthenticationMethod.API_KEY],
            resourceRestrictions: [
              {
                resourceType: 'document',
                allowedOperations: ['read'],
                deniedOperations: ['write']
              }
            ]
          }
        }
      }]);
      
      const writeResult = await securityTrustService.authorizeOperation(
        TEST_AGENT_ID,
        'write',
        'document:123'
      );
      
      console.log('Write operation result:', writeResult);
      
      expect(writeResult.isAuthorized).toBe(false);
    });
  });
  
  describe('establishTrust', () => {
    it('should create a new trust relationship', async () => {
      // Mock no existing relationship
      mockSearchMemories.mockResolvedValueOnce([]);
      
      const relationship = await securityTrustService.establishTrust(
        TEST_AGENT_ID,
        TEST_TARGET_AGENT_ID,
        TrustLevel.HIGH
      );
      
      expect(relationship.sourceAgentId).toBe(TEST_AGENT_ID);
      expect(relationship.targetAgentId).toBe(TEST_TARGET_AGENT_ID);
      expect(relationship.trustLevel).toBe(TrustLevel.HIGH);
      expect(relationship.establishedAt).toBe(1234567890); // Mocked timestamp
      expect(mockAddMemory).toHaveBeenCalledTimes(1);
    });
    
    it('should update existing trust relationship', async () => {
      // Mock existing relationship
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            sourceAgentId: TEST_AGENT_ID,
            targetAgentId: TEST_TARGET_AGENT_ID,
            trustLevel: TrustLevel.MEDIUM,
            establishedAt: 1000000000,
            context: ['initial-context']
          }
        }
      }]);
      
      // For updateTrustLevel, which gets called inside establishTrust
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            sourceAgentId: TEST_AGENT_ID,
            targetAgentId: TEST_TARGET_AGENT_ID,
            trustLevel: TrustLevel.MEDIUM,
            establishedAt: 1000000000,
            context: ['initial-context']
          }
        }
      }]);
      
      const context = { reason: 'updated trust' };
      const relationship = await securityTrustService.establishTrust(
        TEST_AGENT_ID,
        TEST_TARGET_AGENT_ID,
        TrustLevel.HIGH,
        context
      );
      
      expect(relationship.sourceAgentId).toBe(TEST_AGENT_ID);
      expect(relationship.targetAgentId).toBe(TEST_TARGET_AGENT_ID);
      expect(relationship.trustLevel).toBe(TrustLevel.HIGH);
      expect(relationship.context).toContain('initial-context');
      expect(relationship.context).toContain('reason');
      expect(mockAddMemory).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('createSecurityPolicy', () => {
    it('should create a new security policy', async () => {
      const policy = await securityTrustService.createSecurityPolicy({
        name: 'Test Policy',
        description: 'A test security policy',
        requiredTrustLevel: TrustLevel.MEDIUM,
        allowedAuthMethods: [AuthenticationMethod.API_KEY, AuthenticationMethod.JWT],
        isActive: true
      });
      
      expect(policy.name).toBe('Test Policy');
      expect(policy.description).toBe('A test security policy');
      expect(policy.requiredTrustLevel).toBe(TrustLevel.MEDIUM);
      expect(policy.allowedAuthMethods).toContain(AuthenticationMethod.API_KEY);
      expect(policy.allowedAuthMethods).toContain(AuthenticationMethod.JWT);
      expect(policy.isActive).toBe(true);
      expect(policy.createdAt).toBe(1234567890); // Mocked timestamp
      expect(policy.updatedAt).toBe(1234567890); // Mocked timestamp
      expect(mockAddMemory).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('validateMessage', () => {
    it('should validate messages when no security requirements exist', async () => {
      // Mock no recipient security info
      mockSearchMemories.mockResolvedValueOnce([]);
      
      const result = await securityTrustService.validateMessage(
        TEST_AGENT_ID,
        TEST_TARGET_AGENT_ID,
        'Hello world'
      );
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should validate trust level for messages', async () => {
      // Mock recipient security info with required trust level
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_TARGET_AGENT_ID,
            appliedPolicies: [],
            requiredTrustLevel: TrustLevel.HIGH,
            allowedAuthMethods: [AuthenticationMethod.API_KEY]
          }
        }
      }]);
      
      // Mock no trust relationship exists
      mockSearchMemories.mockResolvedValueOnce([]);
      
      const result = await securityTrustService.validateMessage(
        TEST_AGENT_ID,
        TEST_TARGET_AGENT_ID,
        'Hello world'
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('No trust relationship exists');
      
      // Now test with insufficient trust level
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            agentId: TEST_TARGET_AGENT_ID,
            appliedPolicies: [],
            requiredTrustLevel: TrustLevel.HIGH,
            allowedAuthMethods: [AuthenticationMethod.API_KEY]
          }
        }
      }]);
      
      // Mock trust relationship with MEDIUM trust (lower than required HIGH)
      mockSearchMemories.mockResolvedValueOnce([{
        payload: {
          metadata: {
            sourceAgentId: TEST_TARGET_AGENT_ID,
            targetAgentId: TEST_AGENT_ID,
            trustLevel: TrustLevel.MEDIUM
          }
        }
      }]);
      
      const result2 = await securityTrustService.validateMessage(
        TEST_AGENT_ID,
        TEST_TARGET_AGENT_ID,
        'Hello world'
      );
      
      expect(result2.isValid).toBe(false);
      expect(result2.errors?.[0]).toContain('Trust level insufficient');
    });
    
    it('should reject extremely large messages', async () => {
      // Mock no security info (default policies)
      mockSearchMemories.mockResolvedValueOnce([]);
      
      // Create a very large message (over 1MB)
      const largeMessage = 'x'.repeat(1000001);
      
      const result = await securityTrustService.validateMessage(
        TEST_AGENT_ID,
        TEST_TARGET_AGENT_ID,
        largeMessage
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain('exceeds maximum allowed length');
    });
  });
}); 