/**
 * Tests for DefaultPlanRecoverySystem
 * 
 * This file contains tests for the DefaultPlanRecoverySystem implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PlanFailureCategory,
  PlanFailureSeverity,
  PlanRecoveryActionType
} from '../../interfaces/PlanRecovery.interface';
import { DefaultPlanRecoverySystem } from '../DefaultPlanRecoverySystem';

describe('DefaultPlanRecoverySystem', () => {
  let recoverySystem: DefaultPlanRecoverySystem;
  
  beforeEach(async () => {
    recoverySystem = new DefaultPlanRecoverySystem();
    await recoverySystem.initialize();
  });
  
  afterEach(async () => {
    await recoverySystem.shutdown();
  });
  
  it('should initialize successfully', async () => {
    const newSystem = new DefaultPlanRecoverySystem();
    const result = await newSystem.initialize();
    expect(result).toBe(true);
    await newSystem.shutdown();
  });
  
  it('should classify failure correctly', async () => {
    const classification = await recoverySystem.classifyFailure(
      'API request timed out after 30 seconds'
    );
    
    expect(classification.category).toBe(PlanFailureCategory.TIMEOUT);
    expect(classification.severity).toBe(PlanFailureSeverity.MEDIUM);
    expect(classification.confidence).toBeGreaterThan(0);
  });
  
  it('should generate standardized error response', async () => {
    const error = new Error('Resource database is currently unavailable');
    const response = await recoverySystem.generateStandardErrorResponse(error, {
      requestId: 'req-123',
      resources: ['database-1'],
      source: 'database-service'
    });
    
    expect(response.code).toBeDefined();
    expect(response.message).toBe(error.message);
    expect(response.category).toBe(PlanFailureCategory.RESOURCE_UNAVAILABLE);
    expect(response.requestId).toBe('req-123');
    expect(response.resources).toContain('database-1');
    expect(response.source).toBe('database-service');
    expect(response.suggestedActions).toContain(PlanRecoveryActionType.RETRY);
  });
  
  it('should record failure', async () => {
    const failureId = await recoverySystem.recordFailure({
      planId: 'plan-123',
      stepId: 'step-456',
      message: 'API request failed: service unavailable',
      category: PlanFailureCategory.EXTERNAL_API_ERROR,
      severity: PlanFailureSeverity.HIGH,
      timestamp: new Date()
    });
    
    expect(failureId).toBeDefined();
    expect(typeof failureId).toBe('string');
  });
  
  it('should register and get recovery policy', async () => {
    const policyId = 'test-policy-1';
    
    await recoverySystem.registerRecoveryPolicy({
      id: policyId,
      name: 'Test Policy',
      description: 'A test recovery policy',
      targetCategories: [PlanFailureCategory.TIMEOUT, PlanFailureCategory.EXTERNAL_API_ERROR],
      maxRecoveryAttempts: 3,
      escalateAfterMaxAttempts: true,
      actionSequence: [
        {
          type: PlanRecoveryActionType.RETRY,
          applyWhen: {
            attemptNumber: 1
          }
        },
        {
          type: PlanRecoveryActionType.SKIP,
          applyWhen: {
            attemptNumber: 2
          }
        }
      ],
      fallbackAction: PlanRecoveryActionType.ABORT
    });
    
    const policy = await recoverySystem.getRecoveryPolicy(policyId);
    
    expect(policy).not.toBeNull();
    expect(policy?.id).toBe(policyId);
    expect(policy?.name).toBe('Test Policy');
    expect(policy?.actionSequence.length).toBe(2);
  });
  
  it('should update recovery policy', async () => {
    const policyId = 'test-policy-2';
    
    await recoverySystem.registerRecoveryPolicy({
      id: policyId,
      name: 'Original Name',
      description: 'Original description',
      targetCategories: [PlanFailureCategory.TIMEOUT],
      maxRecoveryAttempts: 3,
      escalateAfterMaxAttempts: false,
      actionSequence: [],
      fallbackAction: PlanRecoveryActionType.ABORT
    });
    
    const updateResult = await recoverySystem.updateRecoveryPolicy(policyId, {
      name: 'Updated Name',
      description: 'Updated description',
      escalateAfterMaxAttempts: true
    });
    
    expect(updateResult).toBe(true);
    
    const updatedPolicy = await recoverySystem.getRecoveryPolicy(policyId);
    
    expect(updatedPolicy?.name).toBe('Updated Name');
    expect(updatedPolicy?.description).toBe('Updated description');
    expect(updatedPolicy?.escalateAfterMaxAttempts).toBe(true);
    // Should preserve original values for fields not updated
    expect(updatedPolicy?.maxRecoveryAttempts).toBe(3);
  });
  
  it('should delete recovery policy', async () => {
    const policyId = 'test-policy-3';
    
    await recoverySystem.registerRecoveryPolicy({
      id: policyId,
      name: 'Policy to Delete',
      description: 'A policy that will be deleted',
      targetCategories: [],
      maxRecoveryAttempts: 1,
      escalateAfterMaxAttempts: false,
      actionSequence: [],
      fallbackAction: PlanRecoveryActionType.SKIP
    });
    
    const deleteResult = await recoverySystem.deleteRecoveryPolicy(policyId);
    expect(deleteResult).toBe(true);
    
    const policy = await recoverySystem.getRecoveryPolicy(policyId);
    expect(policy).toBeNull();
  });
  
  it('should get all recovery policies', async () => {
    // First clear any existing policies by shutdown/init
    await recoverySystem.shutdown();
    await recoverySystem.initialize();
    
    await recoverySystem.registerRecoveryPolicy({
      id: 'policy-a',
      name: 'Policy A',
      description: 'Test policy A',
      targetCategories: [],
      maxRecoveryAttempts: 1,
      escalateAfterMaxAttempts: false,
      actionSequence: [],
      fallbackAction: PlanRecoveryActionType.SKIP
    });
    
    await recoverySystem.registerRecoveryPolicy({
      id: 'policy-b',
      name: 'Policy B',
      description: 'Test policy B',
      targetCategories: [],
      maxRecoveryAttempts: 1,
      escalateAfterMaxAttempts: false,
      actionSequence: [],
      fallbackAction: PlanRecoveryActionType.SKIP
    });
    
    const policies = await recoverySystem.getAllRecoveryPolicies();
    
    expect(policies.length).toBe(2);
    expect(policies.map(p => p.id).sort()).toEqual(['policy-a', 'policy-b']);
  });
}); 