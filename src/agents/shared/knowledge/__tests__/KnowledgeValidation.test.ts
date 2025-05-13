/**
 * Knowledge Validation Interface Tests
 * 
 * This file contains tests for the KnowledgeValidation interface,
 * validating that implementations properly adhere to the contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { 
  KnowledgeValidation,
  ValidationMethodType,
  ValidationIssueType,
  ValidationMethod,
  ValidationContext,
  ValidationRequest,
  ValidationStepResult,
  ValidationResult
} from '../interfaces/KnowledgeValidation.interface';
import { 
  KnowledgeValidationLevel, 
  KnowledgeConfidenceLevel 
} from '../interfaces/KnowledgeAcquisition.interface';

// Create mock implementation for testing
class MockKnowledgeValidation implements KnowledgeValidation {
  private methods: Map<string, ValidationMethod> = new Map();
  private requests: Map<string, ValidationRequest> = new Map();
  private results: Map<string, ValidationResult> = new Map();

  async registerValidationMethod(
    method: Omit<ValidationMethod, 'id'>
  ): Promise<ValidationMethod> {
    const id = uuidv4();
    const newMethod: ValidationMethod = {
      ...method,
      id
    };
    
    this.methods.set(id, newMethod);
    return newMethod;
  }

  async getValidationMethod(methodId: string): Promise<ValidationMethod | null> {
    return this.methods.get(methodId) || null;
  }

  async findValidationMethods(options: any = {}): Promise<ValidationMethod[]> {
    let methods = Array.from(this.methods.values());
    
    // Apply filters based on options
    if (options.methodType) {
      methods = methods.filter(m => m.type === options.methodType);
    }
    
    if (options.minReliability !== undefined) {
      methods = methods.filter(m => m.reliability >= options.minReliability);
    }
    
    if (options.validationLevel) {
      methods = methods.filter(m => 
        m.achievableValidationLevels.includes(options.validationLevel)
      );
    }
    
    // Apply limit
    if (options.limit && options.limit > 0) {
      methods = methods.slice(0, options.limit);
    }
    
    return methods;
  }

  async createValidationRequest(
    knowledgeEntryId: string,
    content: string,
    options: any = {}
  ): Promise<ValidationRequest> {
    const id = uuidv4();
    const now = new Date();
    
    // Create default validation context if not provided
    const context: ValidationContext = options.context || {
      existingKnowledgeIds: [],
      externalResources: []
    };
    
    const request: ValidationRequest = {
      id,
      knowledgeEntryId,
      content,
      requestedAt: now,
      requiredLevel: options.requiredLevel || KnowledgeValidationLevel.BASIC,
      minimumConfidence: options.minimumConfidence || 0.7,
      methodIds: options.methodIds || Array.from(this.methods.keys()).slice(0, 2),
      context,
      priority: options.priority || 0.5,
      deadline: options.deadline,
      status: 'pending'
    };
    
    this.requests.set(id, request);
    return request;
  }

  async executeValidationRequest(requestId: string): Promise<ValidationResult> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Validation request not found: ${requestId}`);
    }
    
    // Update request status
    request.status = 'in_progress';
    this.requests.set(requestId, request);
    
    // Create mock validation steps
    const steps: ValidationStepResult[] = [];
    for (const methodId of request.methodIds) {
      const method = this.methods.get(methodId);
      if (!method) {
        continue; // Skip if method not found
      }
      
      // Create mock step result
      steps.push({
        methodId,
        executedAt: new Date(),
        success: true,
        confidenceScore: 0.85,
        issues: [],
        supportingEvidence: ['Evidence item 1', 'Evidence item 2'],
        metrics: {
          executionTimeMs: 500,
          resourcesConsumed: {
            cpu: 0.1,
            memory: 200
          },
          apiCallsMade: 2
        }
      });
    }
    
    // Create a mock validation result
    const result: ValidationResult = {
      requestId,
      knowledgeEntryId: request.knowledgeEntryId,
      completedAt: new Date(),
      success: true,
      achievedLevel: request.requiredLevel,
      confidenceScore: 0.85,
      confidenceLevel: KnowledgeConfidenceLevel.HIGH,
      steps,
      issues: [],
      metrics: {
        totalExecutionTimeMs: 1000,
        methodsApplied: steps.length,
        issuesFound: 0,
        correctionsMade: 0,
        resourcesConsumed: {
          cpu: 0.2,
          memory: 400
        }
      }
    };
    
    // Update request status and result
    request.status = 'completed';
    request.result = result;
    this.requests.set(requestId, request);
    
    // Store the result
    this.results.set(requestId, result);
    
    return result;
  }

  async getValidationRequest(requestId: string): Promise<ValidationRequest | null> {
    return this.requests.get(requestId) || null;
  }

  async getValidationResult(requestId: string): Promise<ValidationResult | null> {
    return this.results.get(requestId) || null;
  }

  async findValidationRequests(options: any = {}): Promise<ValidationRequest[]> {
    let requests = Array.from(this.requests.values());
    
    // Apply filters based on options
    if (options.status) {
      requests = requests.filter(r => r.status === options.status);
    }
    
    if (options.knowledgeEntryId) {
      requests = requests.filter(r => r.knowledgeEntryId === options.knowledgeEntryId);
    }
    
    if (options.requiredLevel) {
      requests = requests.filter(r => r.requiredLevel === options.requiredLevel);
    }
    
    if (options.priorityMin !== undefined) {
      requests = requests.filter(r => r.priority >= options.priorityMin);
    }
    
    if (options.priorityMax !== undefined) {
      requests = requests.filter(r => r.priority <= options.priorityMax);
    }
    
    // Apply limit
    if (options.limit && options.limit > 0) {
      requests = requests.slice(0, options.limit);
    }
    
    return requests;
  }

  async cancelValidationRequest(requestId: string, reason: string): Promise<boolean> {
    const request = this.requests.get(requestId);
    if (!request) {
      return false;
    }
    
    // Cannot cancel completed requests
    if (request.status === 'completed' || request.status === 'failed') {
      return false;
    }
    
    // Update status
    request.status = 'failed';
    this.requests.set(requestId, request);
    
    return true;
  }

  async validateKnowledge(
    content: string,
    options: any = {}
  ): Promise<ValidationResult> {
    // Create a temporary request ID
    const knowledgeEntryId = options.knowledgeEntryId || uuidv4();
    
    // Create a validation request
    const request = await this.createValidationRequest(
      knowledgeEntryId,
      content,
      options
    );
    
    // Execute the request immediately
    return this.executeValidationRequest(request.id);
  }
}

describe('KnowledgeValidation Interface', () => {
  let validation: KnowledgeValidation;
  
  beforeEach(async () => {
    // Create a fresh instance for each test
    validation = new MockKnowledgeValidation();
    
    // Register some test methods for use in tests
    await validation.registerValidationMethod({
      name: 'Basic Consistency Check',
      type: ValidationMethodType.CONSISTENCY_CHECK,
      description: 'Checks for internal consistency of knowledge',
      parameters: {},
      reliability: 0.8,
      achievableValidationLevels: [
        KnowledgeValidationLevel.BASIC,
        KnowledgeValidationLevel.MODERATE
      ]
    });
    
    await validation.registerValidationMethod({
      name: 'Fact Checking',
      type: ValidationMethodType.FACT_CHECK,
      description: 'Verifies facts against known data',
      parameters: {},
      reliability: 0.9,
      achievableValidationLevels: [
        KnowledgeValidationLevel.MODERATE,
        KnowledgeValidationLevel.THOROUGH
      ]
    });
  });

  describe('Validation Method Management', () => {
    it('should register a validation method', async () => {
      const methodData = {
        name: 'Expert Review',
        type: ValidationMethodType.EXPERT_REVIEW,
        description: 'Review by domain expert',
        parameters: { reviewerId: 'expert-1' },
        reliability: 0.95,
        achievableValidationLevels: [
          KnowledgeValidationLevel.EXPERT,
          KnowledgeValidationLevel.PROVEN
        ]
      };
      
      const method = await validation.registerValidationMethod(methodData);
      
      expect(method).toBeDefined();
      expect(method.id).toBeDefined();
      expect(method.name).toBe('Expert Review');
      expect(method.type).toBe(ValidationMethodType.EXPERT_REVIEW);
    });
    
    it('should get a validation method by ID', async () => {
      const methodData = {
        name: 'Logic Validation',
        type: ValidationMethodType.LOGIC_VALIDATION,
        description: 'Validates logical structure',
        parameters: {},
        reliability: 0.85,
        achievableValidationLevels: [KnowledgeValidationLevel.THOROUGH]
      };
      
      const method = await validation.registerValidationMethod(methodData);
      const retrieved = await validation.getValidationMethod(method.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(method.id);
      expect(retrieved?.name).toBe('Logic Validation');
    });
    
    it('should find validation methods by type', async () => {
      // Register another method of the same type
      await validation.registerValidationMethod({
        name: 'Advanced Consistency Check',
        type: ValidationMethodType.CONSISTENCY_CHECK,
        description: 'Advanced consistency validation',
        parameters: {},
        reliability: 0.85,
        achievableValidationLevels: [KnowledgeValidationLevel.THOROUGH]
      });
      
      const methods = await validation.findValidationMethods({
        methodType: ValidationMethodType.CONSISTENCY_CHECK
      });
      
      expect(methods).toHaveLength(2);
      expect(methods[0].type).toBe(ValidationMethodType.CONSISTENCY_CHECK);
      expect(methods[1].type).toBe(ValidationMethodType.CONSISTENCY_CHECK);
    });
    
    it('should find validation methods by reliability', async () => {
      const methods = await validation.findValidationMethods({
        minReliability: 0.85
      });
      
      expect(methods.length).toBeGreaterThan(0);
      expect(methods[0].reliability).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('Validation Request Management', () => {
    it('should create a validation request', async () => {
      const request = await validation.createValidationRequest(
        'knowledge-123',
        'Test knowledge content'
      );
      
      expect(request).toBeDefined();
      expect(request.id).toBeDefined();
      expect(request.knowledgeEntryId).toBe('knowledge-123');
      expect(request.content).toBe('Test knowledge content');
      expect(request.status).toBe('pending');
    });
    
    it('should create request with custom options', async () => {
      const options = {
        requiredLevel: KnowledgeValidationLevel.THOROUGH,
        minimumConfidence: 0.9,
        priority: 0.8,
        deadline: new Date(Date.now() + 3600000), // 1 hour from now
        context: {
          existingKnowledgeIds: ['knowledge-1', 'knowledge-2'],
          externalResources: [
            {
              name: 'Test Resource',
              type: 'api',
              location: 'https://api.example.com'
            }
          ],
          domain: 'test-domain'
        }
      };
      
      const request = await validation.createValidationRequest(
        'knowledge-123',
        'Test content',
        options
      );
      
      expect(request.requiredLevel).toBe(KnowledgeValidationLevel.THOROUGH);
      expect(request.minimumConfidence).toBe(0.9);
      expect(request.priority).toBe(0.8);
      expect(request.deadline).toBeDefined();
      expect(request.context.domain).toBe('test-domain');
      expect(request.context.existingKnowledgeIds).toHaveLength(2);
    });
    
    it('should get a request by ID', async () => {
      const request = await validation.createValidationRequest(
        'knowledge-123',
        'Test content'
      );
      
      const retrieved = await validation.getValidationRequest(request.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(request.id);
      expect(retrieved?.knowledgeEntryId).toBe('knowledge-123');
    });
    
    it('should find requests by status', async () => {
      await validation.createValidationRequest('knowledge-1', 'Content 1');
      await validation.createValidationRequest('knowledge-2', 'Content 2');
      
      const requests = await validation.findValidationRequests({
        status: 'pending'
      });
      
      expect(requests).toHaveLength(2);
      expect(requests[0].status).toBe('pending');
    });
    
    it('should cancel a request', async () => {
      const request = await validation.createValidationRequest(
        'knowledge-123',
        'Test content'
      );
      
      const result = await validation.cancelValidationRequest(request.id, 'Testing');
      
      expect(result).toBe(true);
      
      const updated = await validation.getValidationRequest(request.id);
      expect(updated?.status).toBe('failed');
    });
  });

  describe('Validation Process', () => {
    it('should execute a validation request', async () => {
      const request = await validation.createValidationRequest(
        'knowledge-123',
        'Test content'
      );
      
      const result = await validation.executeValidationRequest(request.id);
      
      expect(result).toBeDefined();
      expect(result.requestId).toBe(request.id);
      expect(result.knowledgeEntryId).toBe('knowledge-123');
      expect(result.success).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
      
      // Request status should be updated
      const updatedRequest = await validation.getValidationRequest(request.id);
      expect(updatedRequest?.status).toBe('completed');
    });
    
    it('should retrieve validation results', async () => {
      const request = await validation.createValidationRequest(
        'knowledge-123',
        'Test content'
      );
      
      await validation.executeValidationRequest(request.id);
      
      const result = await validation.getValidationResult(request.id);
      
      expect(result).toBeDefined();
      expect(result?.requestId).toBe(request.id);
      expect(result?.steps.length).toBeGreaterThan(0);
    });
    
    it('should validate knowledge directly', async () => {
      const result = await validation.validateKnowledge(
        'Test knowledge to validate',
        {
          requiredLevel: KnowledgeValidationLevel.MODERATE
        }
      );
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.achievedLevel).toBe(KnowledgeValidationLevel.MODERATE);
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when executing non-existent request', async () => {
      await expect(validation.executeValidationRequest('non-existent'))
        .rejects.toThrow('Validation request not found');
    });
    
    it('should return null for non-existent method', async () => {
      const method = await validation.getValidationMethod('non-existent');
      expect(method).toBeNull();
    });
    
    it('should return null for non-existent request', async () => {
      const request = await validation.getValidationRequest('non-existent');
      expect(request).toBeNull();
    });
    
    it('should return null for non-existent result', async () => {
      const result = await validation.getValidationResult('non-existent');
      expect(result).toBeNull();
    });
  });
}); 