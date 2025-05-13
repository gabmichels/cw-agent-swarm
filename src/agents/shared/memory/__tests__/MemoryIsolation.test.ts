/**
 * MemoryIsolation.test.ts - Tests for memory isolation functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryIsolationManager } from '../MemoryIsolationManager';
import { 
  MemoryAccessLevel, 
  MemoryPermission,
  createReadOnlyPermissionSet,
  createReadWritePermissionSet,
  createFullPermissionSet
} from '../MemoryScope';

describe('Memory Isolation System', () => {
  let isolationManager: MemoryIsolationManager;

  beforeEach(() => {
    // Create a fresh isolation manager for each test
    isolationManager = new MemoryIsolationManager({
      enableIsolation: true,
      createDefaultPublicScope: true,
      defaultPublicScopeName: 'shared',
      requireSharingAcknowledgment: true
    });
  });

  it('should create private memory scopes for agents', () => {
    // Create a private scope for an agent
    const privateScope = isolationManager.createScope({
      name: 'agent-1-private',
      description: 'Private memory space for Agent 1',
      accessLevel: MemoryAccessLevel.PRIVATE,
      ownerAgentId: 'agent-1'
    });

    expect(privateScope).toBeDefined();
    expect(privateScope.scopeId.name).toBe('agent-1-private');
    expect(privateScope.accessPolicy.accessLevel).toBe(MemoryAccessLevel.PRIVATE);
    expect(privateScope.accessPolicy.ownerAgentId).toBe('agent-1');

    // Check that other agents can't access it
    const accessResult = isolationManager.checkAccess(
      'agent-2',
      privateScope.scopeId.id,
      MemoryPermission.READ
    );

    expect(accessResult.granted).toBe(false);
    expect(accessResult.deniedReason).toBeDefined();
  });

  it('should create shared memory scopes between agents', () => {
    // Create a shared scope for collaboration between agents
    const sharedScope = isolationManager.createScope({
      name: 'project-collaboration',
      description: 'Shared memory space for project collaboration',
      accessLevel: MemoryAccessLevel.SHARED,
      ownerAgentId: 'agent-1',
      agentPermissions: new Map([
        ['agent-2', createReadWritePermissionSet()],
        ['agent-3', createReadOnlyPermissionSet()]
      ])
    });

    expect(sharedScope).toBeDefined();
    expect(sharedScope.scopeId.name).toBe('project-collaboration');
    expect(sharedScope.accessPolicy.accessLevel).toBe(MemoryAccessLevel.SHARED);

    // Check that owner has full access
    const ownerAccessResult = isolationManager.checkAccess(
      'agent-1',
      sharedScope.scopeId.id,
      MemoryPermission.READ
    );
    expect(ownerAccessResult.granted).toBe(true);

    // Check that agent-2 has read-write access
    const readAccessResult = isolationManager.checkAccess(
      'agent-2',
      sharedScope.scopeId.id,
      MemoryPermission.READ
    );
    expect(readAccessResult.granted).toBe(true);

    const writeAccessResult = isolationManager.checkAccess(
      'agent-2',
      sharedScope.scopeId.id,
      MemoryPermission.WRITE
    );
    expect(writeAccessResult.granted).toBe(true);

    // Check that agent-3 has read-only access
    const agent3ReadResult = isolationManager.checkAccess(
      'agent-3',
      sharedScope.scopeId.id,
      MemoryPermission.READ
    );
    expect(agent3ReadResult.granted).toBe(true);

    const agent3WriteResult = isolationManager.checkAccess(
      'agent-3',
      sharedScope.scopeId.id,
      MemoryPermission.WRITE
    );
    expect(agent3WriteResult.granted).toBe(false);

    // Check that agent-4 (not in the permissions list) has no access
    const agent4AccessResult = isolationManager.checkAccess(
      'agent-4',
      sharedScope.scopeId.id,
      MemoryPermission.READ
    );
    expect(agent4AccessResult.granted).toBe(false);
  });

  it('should create public memory scopes accessible by all agents', () => {
    // Create a public scope
    const publicScope = isolationManager.createScope({
      name: 'public-knowledge',
      description: 'Public knowledge base for all agents',
      accessLevel: MemoryAccessLevel.PUBLIC,
      ownerAgentId: 'agent-1',
      defaultPermissions: createReadOnlyPermissionSet()
    });

    expect(publicScope).toBeDefined();
    expect(publicScope.scopeId.name).toBe('public-knowledge');
    expect(publicScope.accessPolicy.accessLevel).toBe(MemoryAccessLevel.PUBLIC);

    // Check that all agents have read access
    for (const agentId of ['agent-1', 'agent-2', 'agent-3', 'agent-4']) {
      const accessResult = isolationManager.checkAccess(
        agentId,
        publicScope.scopeId.id,
        MemoryPermission.READ
      );
      expect(accessResult.granted).toBe(true);
    }

    // But only the owner should have write access
    const ownerWriteAccess = isolationManager.checkAccess(
      'agent-1',
      publicScope.scopeId.id,
      MemoryPermission.WRITE
    );
    expect(ownerWriteAccess.granted).toBe(true);

    const nonOwnerWriteAccess = isolationManager.checkAccess(
      'agent-2',
      publicScope.scopeId.id,
      MemoryPermission.WRITE
    );
    expect(nonOwnerWriteAccess.granted).toBe(false);
  });

  it('should handle memory sharing requests between agents', () => {
    // Create a private scope for agent-1
    const privateScope = isolationManager.createScope({
      name: 'agent-1-private',
      description: 'Private memory space for Agent 1',
      accessLevel: MemoryAccessLevel.PRIVATE,
      ownerAgentId: 'agent-1'
    });

    // Initially, agent-2 has no access
    const initialAccessResult = isolationManager.checkAccess(
      'agent-2',
      privateScope.scopeId.id,
      MemoryPermission.READ
    );
    expect(initialAccessResult.granted).toBe(false);

    // Convert the private scope to shared
    privateScope.accessPolicy.accessLevel = MemoryAccessLevel.SHARED;
    if (!privateScope.accessPolicy.agentPermissions) {
      privateScope.accessPolicy.agentPermissions = new Map();
    }

    // Create a sharing request from agent-1 to agent-2
    const sharingRequest = isolationManager.createSharingRequest(
      'agent-1', // requesting agent
      'agent-2', // target agent
      privateScope.scopeId.id,
      createReadOnlyPermissionSet()
    );

    expect(sharingRequest).toBeDefined();
    expect(sharingRequest?.requestingAgentId).toBe('agent-1');
    expect(sharingRequest?.targetAgentId).toBe('agent-2');
    expect(sharingRequest?.status).toBe('pending');

    // Approve the sharing request
    const responseResult = isolationManager.respondToSharingRequest(
      sharingRequest!.requestId,
      true, // approved
      'Access granted for collaboration'
    );
    expect(responseResult).toBe(true);

    // Now agent-2 should have read access
    const finalAccessResult = isolationManager.checkAccess(
      'agent-2',
      privateScope.scopeId.id,
      MemoryPermission.READ
    );
    expect(finalAccessResult.granted).toBe(true);

    // But agent-2 still shouldn't have write access
    const writeAccessResult = isolationManager.checkAccess(
      'agent-2',
      privateScope.scopeId.id,
      MemoryPermission.WRITE
    );
    expect(writeAccessResult.granted).toBe(false);
  });

  it('should track memory access metrics', () => {
    // Create a scope
    const scope = isolationManager.createScope({
      name: 'metrics-test',
      description: 'Testing scope for metrics',
      accessLevel: MemoryAccessLevel.PUBLIC,
      ownerAgentId: 'agent-1',
      defaultPermissions: createReadOnlyPermissionSet()
    });

    // Perform some access checks to generate metrics
    for (let i = 0; i < 5; i++) {
      isolationManager.checkAccess(
        'agent-1',
        scope.scopeId.id,
        MemoryPermission.READ
      );
    }

    // Add some metrics for agent-2 explicitly
    for (let i = 0; i < 3; i++) {
      const result = isolationManager.checkAccess(
        'agent-2',
        scope.scopeId.id,
        MemoryPermission.READ
      );
      
      // Verify we're getting the expected result
      expect(result.granted).toBe(true);
    }

    // Attempt some denied access
    for (let i = 0; i < 2; i++) {
      const result = isolationManager.checkAccess(
        'agent-2',
        scope.scopeId.id,
        MemoryPermission.WRITE
      );
      
      // Verify we're getting the expected result
      expect(result.granted).toBe(false);
    }

    // Get the metrics
    const metrics = isolationManager.getAccessMetrics();

    // Should have 10 total requests
    expect(metrics.totalRequests).toBe(10);
    
    // 8 granted (5 from agent-1 and 3 from agent-2)
    expect(metrics.grantedRequests).toBe(8);
    
    // 2 denied (from agent-2 write attempts)
    expect(metrics.deniedRequests).toBe(2);

    // Check agent-specific metrics
    expect(metrics.accessByAgent.get('agent-1')).toBe(5);
    
    // Now agent-2 metrics should also be tracked
    expect(metrics.accessByAgent.get('agent-2')).toBe(5);

    // Check scope-specific metrics
    expect(metrics.accessByScope.get(scope.scopeId.id)).toBe(10);
  });

  it('should revoke permissions from agents', () => {
    // Create a shared scope
    const sharedScope = isolationManager.createScope({
      name: 'revoke-test',
      description: 'Testing permission revocation',
      accessLevel: MemoryAccessLevel.SHARED,
      ownerAgentId: 'agent-1',
      agentPermissions: new Map([
        ['agent-2', createReadWritePermissionSet()]
      ])
    });

    // Initially, agent-2 has read-write access
    const initialReadAccess = isolationManager.checkAccess(
      'agent-2',
      sharedScope.scopeId.id,
      MemoryPermission.READ
    );
    expect(initialReadAccess.granted).toBe(true);

    const initialWriteAccess = isolationManager.checkAccess(
      'agent-2',
      sharedScope.scopeId.id,
      MemoryPermission.WRITE
    );
    expect(initialWriteAccess.granted).toBe(true);

    // Revoke write permission from agent-2
    const revokeResult = isolationManager.revokePermissions(
      'agent-2',
      sharedScope.scopeId.id,
      new Set([MemoryPermission.WRITE])
    );
    expect(revokeResult).toBe(true);

    // Now agent-2 should still have read access
    const finalReadAccess = isolationManager.checkAccess(
      'agent-2',
      sharedScope.scopeId.id,
      MemoryPermission.READ
    );
    expect(finalReadAccess.granted).toBe(true);

    // But agent-2 should no longer have write access
    const finalWriteAccess = isolationManager.checkAccess(
      'agent-2',
      sharedScope.scopeId.id,
      MemoryPermission.WRITE
    );
    expect(finalWriteAccess.granted).toBe(false);
  });

  it('should return accessible scopes for an agent', () => {
    // Create multiple scopes for testing
    const privateScope = isolationManager.createScope({
      name: 'agent-1-private',
      description: 'Private memory space for Agent 1',
      accessLevel: MemoryAccessLevel.PRIVATE,
      ownerAgentId: 'agent-1'
    });

    const sharedScope = isolationManager.createScope({
      name: 'shared-space',
      description: 'Shared memory space',
      accessLevel: MemoryAccessLevel.SHARED,
      ownerAgentId: 'agent-1',
      agentPermissions: new Map([
        ['agent-2', createReadOnlyPermissionSet()]
      ])
    });

    isolationManager.createScope({
      name: 'other-private',
      description: 'Private memory space for Agent 2',
      accessLevel: MemoryAccessLevel.PRIVATE,
      ownerAgentId: 'agent-2'
    });

    // Create a public scope specifically for this test to ensure agent-3 has access
    const publicScope = isolationManager.createScope({
      name: 'public-knowledge',
      description: 'Public knowledge base for all agents',
      accessLevel: MemoryAccessLevel.PUBLIC,
      ownerAgentId: 'agent-1',
      defaultPermissions: createReadOnlyPermissionSet()
    });

    // Get accessible scopes for agent-1
    const agent1Scopes = isolationManager.getScopesForAgent('agent-1');
    
    // Should have access to 4 scopes: private, shared, public, and system shared (created in constructor)
    expect(agent1Scopes.length).toBe(4);
    expect(agent1Scopes.some(s => s.scopeId.id === privateScope.scopeId.id)).toBe(true);
    expect(agent1Scopes.some(s => s.scopeId.id === sharedScope.scopeId.id)).toBe(true);
    expect(agent1Scopes.some(s => s.scopeId.id === publicScope.scopeId.id)).toBe(true);

    // Get accessible scopes for agent-2
    const agent2Scopes = isolationManager.getScopesForAgent('agent-2');
    
    // Should have access to 4 scopes: other-private, shared, public, and system shared
    expect(agent2Scopes.length).toBe(4);
    expect(agent2Scopes.some(s => s.scopeId.id === sharedScope.scopeId.id)).toBe(true);
    expect(agent2Scopes.some(s => s.scopeId.id === publicScope.scopeId.id)).toBe(true);
    expect(agent2Scopes.some(s => s.accessPolicy.ownerAgentId === 'agent-2')).toBe(true);

    // Pre-check to verify agent-3 can access public scope
    const accessResult = isolationManager.checkAccess(
      'agent-3',
      publicScope.scopeId.id,
      MemoryPermission.READ
    );
    expect(accessResult.granted).toBe(true);

    // Agent-3 should have access to both public scopes (the one from constructor and the one we created)
    const agent3Scopes = isolationManager.getScopesForAgent('agent-3');
    expect(agent3Scopes.length).toBe(2);
    expect(agent3Scopes.some(s => s.scopeId.id === publicScope.scopeId.id)).toBe(true);
    expect(agent3Scopes.every(s => s.accessPolicy.accessLevel === MemoryAccessLevel.PUBLIC)).toBe(true);
  });
}); 