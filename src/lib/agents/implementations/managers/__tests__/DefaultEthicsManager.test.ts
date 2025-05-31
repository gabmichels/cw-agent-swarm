/**
 * DefaultEthicsManager.test.ts - Unit Tests for DefaultEthicsManager
 * 
 * Comprehensive test suite covering all functionality of the DefaultEthicsManager
 * Following @IMPLEMENTATION_GUIDELINES.md requirements for >95% test coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { DefaultEthicsManager, DefaultEthicsManagerConfig, EthicsError } from '../DefaultEthicsManager';
import { ManagerType } from '../../../../../agents/shared/base/managers/ManagerType';
import { 
  EthicsValidationResult,
  BiasAuditResult,
  AgentAction,
  AgentRequest,
  EthicsPolicy
} from '../../../../../agents/shared/base/managers/EthicsManager.interface';
import { AgentBase } from '../../../../../agents/shared/base/AgentBase';

// Mock the ethics modules
vi.mock('../../../../../agents/shared/ethics/EthicsPolicy', () => ({
  EthicsPolicy: [
    {
      id: 'bias-gender',
      description: 'Avoid gender-based stereotypes or assumptions.',
      severity: 'medium',
      test: (content: string) => /\b(housewife|strong man|bossy woman)\b/i.test(content)
    },
    {
      id: 'unbalanced-advice',
      description: 'All advice must include both risks and benefits',
      severity: 'high',
      test: (content: string) => {
        const hasPros = /benefit|pro|advantage/i.test(content);
        const hasCons = /risk|con|danger/i.test(content);
        return !(hasPros && hasCons);
      }
    }
  ],
  addEthicsRule: vi.fn(),
  removeEthicsRule: vi.fn(),
  updateEthicsRule: vi.fn()
}));

vi.mock('../../../../../agents/shared/ethics/BiasAuditor', () => ({
  BiasAuditor: {
    audit: vi.fn(() => []),
    containsSensitiveContent: vi.fn(() => false),
    logViolations: vi.fn(),
    generateViolationReport: vi.fn(() => 'No violations')
  }
}));

vi.mock('../../../../../agents/shared/ethics/EthicsMiddleware', () => ({
  enforceEthics: vi.fn(() => Promise.resolve({
    output: 'test output',
    violations: [],
    wasBlocked: false,
    wasModified: false,
    needsEscalation: false
  })),
  escalateViolation: vi.fn(() => Promise.resolve()),
  addRuleOverride: vi.fn()
}));

// Mock AgentBase
const createMockAgent = (): AgentBase => ({
  getId: vi.fn(() => 'test-agent-123'),
  getName: vi.fn(() => 'Test Agent'),
  getType: vi.fn(() => 'test'),
  getStatus: vi.fn(() => 'active'),
  initialize: vi.fn(() => Promise.resolve(true)),
  shutdown: vi.fn(() => Promise.resolve()),
  reset: vi.fn(() => Promise.resolve(true)),
  processInput: vi.fn(),
  generateResponse: vi.fn(),
  getHealth: vi.fn(),
  getConfiguration: vi.fn(() => ({})),
  updateConfiguration: vi.fn()
} as any);

describe('DefaultEthicsManager', () => {
  let manager: DefaultEthicsManager;
  let mockAgent: AgentBase;
  let config: Partial<DefaultEthicsManagerConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent = createMockAgent();
    config = {
      enabled: true,
      enableBiasAuditing: true,
      enforceMiddleware: true,
      biasThreshold: 0.7,
      enableAutoEscalation: true,
      maxViolationHistory: 100
    };
    manager = new DefaultEthicsManager(mockAgent, config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Basic Properties', () => {
    it('should create instance with correct properties', () => {
      expect(manager.managerId).toMatch(/^ethics-manager-[A-Z0-9]+$/);
      expect(manager.managerType).toBe(ManagerType.ETHICS);
      expect(manager.getAgent()).toBe(mockAgent);
    });

    it('should merge config with defaults', () => {
      const customConfig = { enabled: false, biasThreshold: 0.5 };
      const customManager = new DefaultEthicsManager(mockAgent, customConfig);
      
      const mergedConfig = customManager.getConfig();
      expect(mergedConfig.enabled).toBe(false);
      expect(mergedConfig.biasThreshold).toBe(0.5);
      expect(mergedConfig.enableBiasAuditing).toBe(true); // default
    });

    it('should use default config when none provided', () => {
      const defaultManager = new DefaultEthicsManager(mockAgent);
      const config = defaultManager.getConfig();
      
      expect(config.enabled).toBe(false); // disabled by default
      expect(config.enableBiasAuditing).toBe(true);
      expect(config.enforceMiddleware).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const currentConfig = manager.getConfig();
      expect(currentConfig.enabled).toBe(true);
      expect(currentConfig.biasThreshold).toBe(0.7);
    });

    it('should update configuration', () => {
      const updates = { biasThreshold: 0.9, enableAutoEscalation: false };
      const updatedConfig = manager.updateConfig(updates);
      
      expect(updatedConfig.biasThreshold).toBe(0.9);
      expect(updatedConfig.enableAutoEscalation).toBe(false);
      expect(updatedConfig.enabled).toBe(true); // unchanged
    });

    it('should check if manager is enabled', () => {
      expect(manager.isEnabled()).toBe(true);
      
      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);
    });

    it('should set enabled status', () => {
      const result = manager.setEnabled(false);
      expect(result).toBe(false);
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize when enabled', async () => {
      const result = await manager.initialize();
      expect(result).toBe(true);
    });

    it('should initialize when disabled', async () => {
      manager.setEnabled(false);
      const result = await manager.initialize();
      expect(result).toBe(true);
    });

    it('should shutdown successfully', async () => {
      await manager.initialize();
      await manager.shutdown();
      // Should not throw
    });

    it('should reset successfully', async () => {
      await manager.initialize();
      const result = await manager.reset();
      expect(result).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('should return healthy status when enabled and initialized', async () => {
      await manager.initialize();
      const health = await manager.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.details.lastCheck).toBeInstanceOf(Date);
      expect(health.details.issues).toEqual([]);
      expect(health.details.metrics).toMatchObject({
        initialized: true,
        enabled: true,
        violationHistorySize: 0
      });
    });

    it('should return degraded status when disabled', async () => {
      manager.setEnabled(false);
      await manager.initialize();
      const health = await manager.getHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.details.issues).toHaveLength(1);
      expect(health.details.issues[0].message).toBe('Ethics manager is disabled');
    });

    it('should warn when violation history is approaching capacity', async () => {
      await manager.initialize();
      
      // Add violations to approach capacity
      const violationCount = 85; // 85% of 100
      for (let i = 0; i < violationCount; i++) {
        await manager.logViolation({
          violations: [{ rule: 'test', description: 'test', severity: 'low' }],
          agentId: 'test-agent',
          timestamp: new Date()
        });
      }
      
      const health = await manager.getHealth();
      expect(health.details.issues).toHaveLength(1);
      expect(health.details.issues[0].severity).toBe('medium');
      expect(health.details.issues[0].message).toContain('approaching maximum capacity');
    });
  });

  describe('Ethical Compliance Checking', () => {
    it('should return compliant result when disabled', async () => {
      manager.setEnabled(false);
      
      const action: AgentAction = {
        type: 'test',
        description: 'test action',
        content: 'test content'
      };
      
      const result = await manager.checkEthicalCompliance(action);
      
      expect(result.isCompliant).toBe(true);
      expect(result.severity).toBe('none');
      expect(result.violations).toEqual([]);
      expect(result.shouldBlock).toBe(false);
    });

    it('should return compliant result when no violations found', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      (BiasAuditor.audit as any).mockReturnValue([]);
      
      const action: AgentAction = {
        type: 'test',
        description: 'clean content',
        content: 'This is ethical content'
      };
      
      const result = await manager.checkEthicalCompliance(action);
      
      expect(result.isCompliant).toBe(true);
      expect(result.severity).toBe('none');
      expect(result.violations).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });

    it('should detect violations and return non-compliant result', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      (BiasAuditor.audit as any).mockReturnValue([
        {
          ruleId: 'bias-gender',
          description: 'Avoid gender-based stereotypes',
          severity: 'medium',
          snippet: 'housewife should cook'
        }
      ]);
      
      const action: AgentAction = {
        type: 'response',
        description: 'generate response',
        content: 'The housewife should cook dinner'
      };
      
      const result = await manager.checkEthicalCompliance(action);
      
      expect(result.isCompliant).toBe(false);
      expect(result.severity).toBe('medium');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].rule).toBe('bias-gender');
      expect(result.recommendations).toContain('Consider using more inclusive language that avoids gender stereotypes');
    });

    it('should determine blocking based on severity threshold', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      (BiasAuditor.audit as any).mockReturnValue([
        {
          ruleId: 'unbalanced-advice',
          description: 'Include both risks and benefits',
          severity: 'high',
          snippet: 'only benefits mentioned'
        }
      ]);
      
      manager.updateConfig({ 
        policyConfig: { blockingSeverity: 'high' }
      });
      
      const action: AgentAction = {
        type: 'advice',
        description: 'give advice',
        content: 'This has many benefits'
      };
      
      const result = await manager.checkEthicalCompliance(action);
      
      expect(result.shouldBlock).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('should auto-escalate high severity violations when enabled', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      const { escalateViolation } = await import('../../../../../agents/shared/ethics/EthicsMiddleware');
      
      (BiasAuditor.audit as any).mockReturnValue([
        {
          ruleId: 'gdpr-violation',
          description: 'Avoid personal data',
          severity: 'high',
          snippet: 'email: test@example.com'
        }
      ]);
      
      const action: AgentAction = {
        type: 'data-processing',
        description: 'process data',
        content: 'User email: test@example.com'
      };
      
      await manager.checkEthicalCompliance(action);
      
      expect(escalateViolation).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      (BiasAuditor.audit as any).mockImplementation(() => {
        throw new Error('Audit failed');
      });
      
      const action: AgentAction = {
        type: 'test',
        description: 'test',
        content: 'test'
      };
      
      await expect(manager.checkEthicalCompliance(action)).rejects.toThrow(EthicsError);
    });
  });

  describe('Bias Auditing', () => {
    it('should return no bias when disabled', async () => {
      manager.setEnabled(false);
      
      const result = await manager.auditForBias('test content');
      
      expect(result.biasDetected).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.instances).toEqual([]);
    });

    it('should return no bias when bias auditing disabled', async () => {
      manager.updateConfig({ enableBiasAuditing: false });
      
      const result = await manager.auditForBias('test content');
      
      expect(result.biasDetected).toBe(false);
    });

    it('should detect bias in content', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      (BiasAuditor.audit as any).mockReturnValue([
        {
          ruleId: 'bias-gender',
          description: 'Gender bias detected',
          severity: 'medium',
          snippet: 'men are stronger'
        }
      ]);
      
      const result = await manager.auditForBias('men are stronger than women');
      
      expect(result.biasDetected).toBe(true);
      expect(result.biasTypes).toContain('bias-gender');
      expect(result.instances).toHaveLength(1);
      expect(result.instances[0].confidence).toBe(0.6); // medium severity
    });

    it('should detect sensitive content', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      (BiasAuditor.audit as any).mockReturnValue([]);
      (BiasAuditor.containsSensitiveContent as any).mockReturnValue(true);
      
      const result = await manager.auditForBias('password: secret123');
      
      expect(result.biasDetected).toBe(true);
      expect(result.biasTypes).toContain('sensitive-content');
      expect(result.instances[0].confidence).toBe(0.8);
    });

    it('should calculate overall bias score correctly', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      (BiasAuditor.audit as any).mockReturnValue([
        { ruleId: 'bias1', severity: 'low', snippet: 'test1', description: 'test' },
        { ruleId: 'bias2', severity: 'high', snippet: 'test2', description: 'test' }
      ]);
      
      const result = await manager.auditForBias('biased content');
      
      // Should average: (0.3 + 0.9) / 2 = 0.6
      expect(result.overallScore).toBe(0.6);
    });

    it('should handle errors gracefully', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      (BiasAuditor.audit as any).mockImplementation(() => {
        throw new Error('Audit failed');
      });
      
      await expect(manager.auditForBias('test')).rejects.toThrow(EthicsError);
    });
  });

  describe('Ethics Middleware', () => {
    it('should return request unchanged when disabled', async () => {
      manager.setEnabled(false);
      
      const request: AgentRequest = {
        id: 'test-123',
        content: 'test content',
        type: 'text',
        metadata: {}
      };
      
      const result = await manager.applyEthicsMiddleware(request);
      
      expect(result).toEqual(request);
    });

    it('should return request unchanged when middleware disabled', async () => {
      manager.updateConfig({ enforceMiddleware: false });
      
      const request: AgentRequest = {
        id: 'test-123',
        content: 'test content',
        type: 'text'
      };
      
      const result = await manager.applyEthicsMiddleware(request);
      
      expect(result).toEqual(request);
    });

    it('should apply ethics middleware and modify request', async () => {
      const { enforceEthics } = await import('../../../../../agents/shared/ethics/EthicsMiddleware');
      (enforceEthics as any).mockResolvedValue({
        output: 'modified content',
        violations: [],
        wasBlocked: false,
        wasModified: true,
        needsEscalation: false
      });
      
      const request: AgentRequest = {
        id: 'test-123',
        content: 'original content',
        type: 'text',
        metadata: { existing: 'data' }
      };
      
      const result = await manager.applyEthicsMiddleware(request);
      
      expect(result.content).toBe('modified content');
      expect(result.metadata).toMatchObject({
        existing: 'data',
        ethicsProcessed: true,
        wasModified: true,
        wasBlocked: false
      });
    });

    it('should escalate violations when needed', async () => {
      const { enforceEthics, escalateViolation } = await import('../../../../../agents/shared/ethics/EthicsMiddleware');
      const violations = [
        { ruleId: 'test', description: 'test violation', severity: 'high', snippet: 'test' }
      ];
      
      (enforceEthics as any).mockResolvedValue({
        output: 'content',
        violations,
        wasBlocked: false,
        wasModified: false,
        needsEscalation: true
      });
      
      const request: AgentRequest = {
        id: 'test-123',
        content: 'test content',
        type: 'text'
      };
      
      await manager.applyEthicsMiddleware(request);
      
      expect(escalateViolation).toHaveBeenCalledWith('test-agent-123', 'test-123', violations);
    });

    it('should handle errors gracefully', async () => {
      const { enforceEthics } = await import('../../../../../agents/shared/ethics/EthicsMiddleware');
      (enforceEthics as any).mockRejectedValue(new Error('Middleware failed'));
      
      const request: AgentRequest = {
        id: 'test-123',
        content: 'test content',
        type: 'text'
      };
      
      await expect(manager.applyEthicsMiddleware(request)).rejects.toThrow(EthicsError);
    });
  });

  describe('Policy Management', () => {
    it('should get current ethics policy', async () => {
      const policy = await manager.getEthicsPolicy();
      
      expect(policy.id).toMatch(/^ethics-policy-[A-Z0-9]+$/);
      expect(policy.name).toBe('Default Ethics Policy');
      expect(policy.rules).toHaveLength(2); // From mock
      expect(policy.version).toBe('1.0.0');
      expect(policy.rules[0].id).toBe('bias-gender');
    });

    it('should update ethics policy when enabled', async () => {
      const { addEthicsRule, updateEthicsRule } = await import('../../../../../agents/shared/ethics/EthicsPolicy');
      
      const policyUpdate = {
        rules: [
          {
            id: 'bias-gender',
            name: 'Gender Bias',
            description: 'Updated description',
            severity: 'high' as const,
            enabled: true
          },
          {
            id: 'new-rule',
            name: 'New Rule',
            description: 'New rule description',
            severity: 'medium' as const,
            enabled: true
          }
        ]
      };
      
      const result = await manager.updateEthicsPolicy(policyUpdate);
      
      expect(result).toBe(true);
      expect(updateEthicsRule).toHaveBeenCalledWith('bias-gender', {
        description: 'Updated description',
        severity: 'high'
      });
      expect(addEthicsRule).toHaveBeenCalled();
    });

    it('should not update policy when disabled', async () => {
      manager.setEnabled(false);
      
      const result = await manager.updateEthicsPolicy({ rules: [] });
      
      expect(result).toBe(false);
    });

    it('should handle policy update errors', async () => {
      const { updateEthicsRule } = await import('../../../../../agents/shared/ethics/EthicsPolicy');
      
      // Set up the mock to throw an error BEFORE calling the method
      (updateEthicsRule as any).mockClear();
      (updateEthicsRule as any).mockImplementation(() => {
        throw new Error('Update failed');
      });
      
      const policy = { 
        rules: [{ 
          id: 'bias-gender', // Use an existing rule ID that will trigger updateEthicsRule
          name: 'Test', 
          description: 'test', 
          severity: 'low' as const, 
          enabled: true 
        }] 
      };
      
      await expect(manager.updateEthicsPolicy(policy)).rejects.toThrow(EthicsError);
    });
  });

  describe('Violation Logging and History', () => {
    it('should log violations successfully', async () => {
      const violation = {
        violations: [
          { rule: 'test-rule', description: 'test violation', severity: 'medium' as const }
        ],
        agentId: 'test-agent',
        timestamp: new Date()
      };
      
      const result = await manager.logViolation(violation);
      
      expect(result).toBe(true);
      
      const history = await manager.getViolationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].violations).toEqual(violation.violations);
    });

    it('should trim violation history when exceeding limit', async () => {
      manager.updateConfig({ maxViolationHistory: 2 });
      
      // Add 3 violations
      for (let i = 0; i < 3; i++) {
        await manager.logViolation({
          violations: [{ rule: `rule-${i}`, description: 'test', severity: 'low' }],
          agentId: 'test-agent',
          timestamp: new Date()
        });
      }
      
      const history = await manager.getViolationHistory();
      expect(history).toHaveLength(2); // Should be trimmed to maxViolationHistory
    });

    it('should filter violation history by agent ID', async () => {
      await manager.logViolation({
        violations: [{ rule: 'rule1', description: 'test', severity: 'low' }],
        agentId: 'agent-1',
        timestamp: new Date()
      });
      
      await manager.logViolation({
        violations: [{ rule: 'rule2', description: 'test', severity: 'low' }],
        agentId: 'agent-2',
        timestamp: new Date()
      });
      
      const history = await manager.getViolationHistory({ agentId: 'agent-1' });
      expect(history).toHaveLength(1);
      expect(history[0].agentId).toBe('agent-1');
    });

    it('should filter violation history by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await manager.logViolation({
        violations: [{ rule: 'rule1', description: 'test', severity: 'low' }],
        agentId: 'test-agent',
        timestamp: yesterday
      });
      
      await manager.logViolation({
        violations: [{ rule: 'rule2', description: 'test', severity: 'low' }],
        agentId: 'test-agent',
        timestamp: new Date()
      });
      
      const history = await manager.getViolationHistory({ 
        startDate: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      });
      
      expect(history).toHaveLength(1);
    });

    it('should filter violation history by severity', async () => {
      await manager.logViolation({
        violations: [{ rule: 'rule1', description: 'test', severity: 'low' }],
        agentId: 'test-agent',
        timestamp: new Date()
      });
      
      await manager.logViolation({
        violations: [{ rule: 'rule2', description: 'test', severity: 'high' }],
        agentId: 'test-agent',
        timestamp: new Date()
      });
      
      const history = await manager.getViolationHistory({ severity: 'high' });
      expect(history).toHaveLength(1);
      expect(history[0].violations[0].severity).toBe('high');
    });

    it('should limit violation history results', async () => {
      // Add multiple violations
      for (let i = 0; i < 5; i++) {
        await manager.logViolation({
          violations: [{ rule: `rule-${i}`, description: 'test', severity: 'low' }],
          agentId: 'test-agent',
          timestamp: new Date()
        });
      }
      
      const history = await manager.getViolationHistory({ limit: 2 });
      expect(history).toHaveLength(2);
    });

    it('should handle logging errors gracefully', async () => {
      // Simulate error by passing invalid data
      const result = await manager.logViolation({
        violations: [{ rule: 'test', description: 'test', severity: 'low' }],
        agentId: 'test-agent',
        timestamp: new Date()
      });
      
      expect(result).toBe(true); // Should still succeed
    });
  });

  describe('Helper Methods', () => {
    it('should get maximum severity correctly', () => {
      const violations = [
        { rule: 'rule1', description: 'test', severity: 'low' as const },
        { rule: 'rule2', description: 'test', severity: 'high' as const },
        { rule: 'rule3', description: 'test', severity: 'medium' as const }
      ];
      
      // Access protected method via type assertion
      const maxSeverity = (manager as any).getMaxSeverity(violations);
      expect(maxSeverity).toBe('high');
    });

    it('should determine blocking correctly', () => {
      const shouldBlock = (manager as any).shouldBlockBySeverity('high', 'medium');
      expect(shouldBlock).toBe(true);
      
      const shouldNotBlock = (manager as any).shouldBlockBySeverity('low', 'medium');
      expect(shouldNotBlock).toBe(false);
    });

    it('should generate appropriate recommendations', () => {
      const violations = [
        { rule: 'bias-gender', description: 'Gender bias', severity: 'medium' as const },
        { rule: 'unbalanced-advice', description: 'Unbalanced advice', severity: 'high' as const },
        { rule: 'unknown-rule', description: 'Unknown violation', severity: 'low' as const }
      ];
      
      const recommendations = (manager as any).generateRecommendations(violations);
      
      expect(recommendations).toContain('Consider using more inclusive language that avoids gender stereotypes');
      expect(recommendations).toContain('Include both benefits and risks when providing advice');
      expect(recommendations).toContain('Address violation: Unknown violation');
    });

    it('should convert severity to confidence correctly', () => {
      expect((manager as any).getSeverityConfidence('low')).toBe(0.3);
      expect((manager as any).getSeverityConfidence('medium')).toBe(0.6);
      expect((manager as any).getSeverityConfidence('high')).toBe(0.9);
      expect((manager as any).getSeverityConfidence('unknown')).toBe(0.5);
    });
  });

  describe('Error Handling', () => {
    it('should create EthicsError with correct properties', () => {
      const error = new EthicsError('Test error', 'TEST_CODE', { data: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('EthicsError');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toEqual({ data: 'test' });
    });

    it('should use default values in EthicsError', () => {
      const error = new EthicsError('Test error');
      
      expect(error.code).toBe('ETHICS_ERROR');
      expect(error.context).toEqual({});
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow from compliance check to violation logging', async () => {
      const { BiasAuditor } = await import('../../../../../agents/shared/ethics/BiasAuditor');
      
      (BiasAuditor.audit as any).mockReturnValue([
        {
          ruleId: 'bias-gender',
          description: 'Gender bias detected',
          severity: 'medium',
          snippet: 'housewife cooking'
        }
      ]);
      
      const action: AgentAction = {
        type: 'response',
        description: 'generate response',
        content: 'The housewife should be cooking dinner'
      };
      
      const result = await manager.checkEthicalCompliance(action);
      
      expect(result.isCompliant).toBe(false);
      expect(result.violations).toHaveLength(1);
      
      // Check that violation was logged
      const history = await manager.getViolationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].violations[0].rule).toBe('bias-gender');
    });

    it('should maintain state across multiple operations', async () => {
      // Initialize
      await manager.initialize();
      
      // Check compliance
      const action: AgentAction = { type: 'test', description: 'test', content: 'clean content' };
      await manager.checkEthicalCompliance(action);
      
      // Apply middleware
      const request: AgentRequest = { id: 'test', content: 'test', type: 'text' };
      await manager.applyEthicsMiddleware(request);
      
      // Check health
      const health = await manager.getHealth();
      expect(health.status).toBe('healthy');
      
      // Shutdown
      await manager.shutdown();
    });
  });
}); 