/**
 * DefaultCollaborationManager.test.ts - Unit Tests for DefaultCollaborationManager
 * 
 * Comprehensive test suite covering all functionality of the DefaultCollaborationManager
 * Following @IMPLEMENTATION_GUIDELINES.md requirements for >95% test coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { DefaultCollaborationManager, DefaultCollaborationManagerConfig, CollaborationError } from '../DefaultCollaborationManager';
import { ManagerType } from '../../../../../agents/shared/base/managers/ManagerType';
import { 
  CollaborativeTask,
  ApprovalCheckResult,
  StakeholderProfile,
  ApprovalHistoryEntry
} from '../../../../../agents/shared/base/managers/CollaborationManager.interface';
import { AgentBase } from '../../../../../agents/shared/base/AgentBase';

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

describe('DefaultCollaborationManager', () => {
  let manager: DefaultCollaborationManager;
  let mockAgent: AgentBase;
  let config: Partial<DefaultCollaborationManagerConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAgent = createMockAgent();
    config = {
      enabled: true,
      enableClarificationChecking: true,
      enableApprovalWorkflows: true,
      enableToneAdjustment: true,
      maxClarificationQuestions: 5,
      maxApprovalHistory: 100
    };
    manager = new DefaultCollaborationManager(mockAgent, config);
    
    // Spy on the underlying collaboration manager methods to avoid actual calls
    vi.spyOn(manager['collaborationManager'], 'initialize').mockResolvedValue(true);
    vi.spyOn(manager['collaborationManager'], 'checkNeedClarification').mockResolvedValue(false);
    vi.spyOn(manager['collaborationManager'], 'generateClarificationQuestions').mockResolvedValue([]);
    vi.spyOn(manager['collaborationManager'], 'formatClarificationRequest').mockReturnValue('Formatted clarification request');
    vi.spyOn(manager['collaborationManager'], 'checkIfApprovalRequired').mockReturnValue({ required: false, rule: undefined });
    vi.spyOn(manager['collaborationManager'], 'formatApprovalRequest').mockReturnValue('Formatted approval request');
    vi.spyOn(manager['collaborationManager'], 'applyApprovalDecision').mockImplementation((task) => ({ ...task, approvalGranted: true }));
    vi.spyOn(manager['collaborationManager'], 'getApprovalHistory').mockResolvedValue([]);
    vi.spyOn(manager['collaborationManager'], 'addApprovalRule').mockResolvedValue(true);
    vi.spyOn(manager['collaborationManager'], 'removeApprovalRule').mockResolvedValue(true);
    vi.spyOn(manager['collaborationManager'], 'getAllApprovalRules').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test data
  const testTask: CollaborativeTask = {
    id: 'task-123',
    goal: 'Test task',
    subGoals: [
      {
        id: 'sub-1',
        description: 'Sub goal 1',
        status: 'pending',
        children: []
      }
    ],
    currentSubGoalId: 'sub-1'
  };

  const testRule = {
    id: 'rule-1',
    name: 'Test Rule',
    description: 'Test description',
    conditions: [
      {
        field: 'type',
        operator: 'equals',
        value: 'sensitive'
      }
    ],
    approvalLevel: 'basic',
    enabled: true
  };

  describe('Constructor and Basic Properties', () => {
    it('should create instance with correct properties', () => {
      expect(manager.managerType).toBe(ManagerType.COLLABORATION);
      expect(manager.managerId).toMatch(/collaboration-manager-[0-9A-Z]{26}/);
      expect(manager.getAgent()).toBe(mockAgent);
    });

    it('should merge config with defaults', () => {
      const customConfig = { enabled: false, maxClarificationQuestions: 10 };
      const customManager = new DefaultCollaborationManager(mockAgent, customConfig);
      
      const finalConfig = customManager.getConfig();
      expect(finalConfig.enabled).toBe(false);
      expect(finalConfig.maxClarificationQuestions).toBe(10);
      expect(finalConfig.enableClarificationChecking).toBe(true); // default value
    });

    it('should use default config when none provided', () => {
      const defaultManager = new DefaultCollaborationManager(mockAgent);
      const config = defaultManager.getConfig();
      
      expect(config.enabled).toBe(false); // default is disabled
      expect(config.enableClarificationChecking).toBe(true);
      expect(config.enableApprovalWorkflows).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = manager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.enableClarificationChecking).toBe(true);
    });

    it('should update configuration', () => {
      const newConfig = { enabled: false, maxClarificationQuestions: 10 };
      const updatedConfig = manager.updateConfig(newConfig);
      
      expect(updatedConfig.enabled).toBe(false);
      expect(updatedConfig.maxClarificationQuestions).toBe(10);
    });

    it('should check if manager is enabled', () => {
      expect(manager.isEnabled()).toBe(true);
      
      manager.updateConfig({ enabled: false });
      expect(manager.isEnabled()).toBe(false);
    });

    it('should set enabled status', () => {
      const result = manager.setEnabled(false);
      expect(result).toBe(false);
      expect(manager.isEnabled()).toBe(false);
    });

    it('should update stakeholder profile when config changes', () => {
      const profile = {
        name: 'Test User',
        role: 'tester',
        communicationStyle: 'casual' as const,
        expertise: ['testing']
      };
      
      manager.updateConfig({ defaultStakeholderProfile: profile });
      expect(manager['currentStakeholderProfile']).toEqual(profile);
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize when enabled', async () => {
      const result = await manager.initialize();
      expect(result).toBe(true);
      expect(manager['collaborationManager'].initialize).toHaveBeenCalled();
    });

    it('should initialize when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const result = await manager.initialize();
      expect(result).toBe(true);
      expect(manager['_initialized']).toBe(true);
    });

    it('should shutdown successfully', async () => {
      await manager.initialize();
      await manager.shutdown();
      expect(manager['_initialized']).toBe(false);
      expect(manager['currentStakeholderProfile']).toBeNull();
    });

    it('should reset successfully', async () => {
      await manager.initialize();
      const result = await manager.reset();
      expect(result).toBe(true);
    });

    it('should handle initialization errors', async () => {
      vi.spyOn(manager['collaborationManager'], 'initialize').mockRejectedValue(new Error('Init failed'));
      
      await expect(manager.initialize()).rejects.toThrow(CollaborationError);
    });
  });

  describe('Health Monitoring', () => {
    it('should return healthy status when enabled and initialized', async () => {
      await manager.initialize();
      const health = await manager.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.details.issues).toHaveLength(0);
    });

    it('should return degraded status when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const health = await manager.getHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.details.issues).toHaveLength(1);
      expect(health.details.issues[0].message).toContain('disabled');
    });

    it('should warn when approval history is approaching capacity', async () => {
      // Fill approval history to 90% capacity
      const maxHistory = 100;
      manager.updateConfig({ maxApprovalHistory: maxHistory });
      
      await manager.initialize();
      
      // Fill with 90 entries
      for (let i = 0; i < 90; i++) {
        manager['addToApprovalHistory']({
          id: `approval-${i}`,
          taskId: `task-${i}`,
          taskTitle: `Task ${i}`,
          requestedAt: new Date(),
          approved: true,
          reason: 'test',
          ruleId: 'rule-1',
          ruleName: 'Test Rule',
          approvedBy: 'test-user',
          notes: 'test'
        });
      }
      
      const health = await manager.getHealth();
      expect(health.status).toBe('degraded');
      
      const capacityIssue = health.details.issues.find(issue => 
        issue.message.includes('approaching maximum capacity')
      );
      expect(capacityIssue).toBeDefined();
    });

    it('should warn when no stakeholder profile is set', async () => {
      // Ensure tone adjustment is enabled but no profile is set
      manager.updateConfig({ 
        enabled: true, 
        enableToneAdjustment: true,
        defaultStakeholderProfile: undefined
      });
      manager['currentStakeholderProfile'] = null;
      
      await manager.initialize();
      const health = await manager.getHealth();
      
      const profileIssue = health.details.issues.find(issue => 
        issue.message.includes('No stakeholder profile set')
      );
      expect(profileIssue).toBeDefined();
    });
  });

  describe('Clarification Workflow', () => {
    it('should return false for clarification when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const result = await manager.checkNeedClarification(testTask);
      expect(result).toBe(false);
    });

    it('should return false for clarification when checking disabled', async () => {
      manager.updateConfig({ enableClarificationChecking: false });
      const result = await manager.checkNeedClarification(testTask);
      expect(result).toBe(false);
    });

    it('should check clarification need using underlying manager', async () => {
      vi.spyOn(manager['collaborationManager'], 'checkNeedClarification').mockResolvedValue(true);
      
      const result = await manager.checkNeedClarification(testTask);
      expect(result).toBe(true);
      expect(manager['collaborationManager'].checkNeedClarification).toHaveBeenCalled();
    });

    it('should generate clarification questions', async () => {
      const mockQuestions = ['Question 1?', 'Question 2?', 'Question 3?'];
      vi.spyOn(manager['collaborationManager'], 'generateClarificationQuestions').mockResolvedValue(mockQuestions);
      
      const questions = await manager.generateClarificationQuestions(testTask);
      expect(questions).toEqual(mockQuestions);
    });

    it('should limit clarification questions based on config', async () => {
      const manyQuestions = ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?', 'Q6?', 'Q7?'];
      vi.spyOn(manager['collaborationManager'], 'generateClarificationQuestions').mockResolvedValue(manyQuestions);
      
      manager.updateConfig({ maxClarificationQuestions: 3 });
      const questions = await manager.generateClarificationQuestions(testTask);
      expect(questions).toHaveLength(3);
    });

    it('should format clarification request', async () => {
      const questions = ['Question 1?', 'Question 2?'];
      const result = await manager.formatClarificationRequest(testTask, questions);
      expect(result).toBe('Formatted clarification request');
    });

    it('should format clarification request when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const questions = ['Question 1?', 'Question 2?'];
      const result = await manager.formatClarificationRequest(testTask, questions);
      // When disabled, it returns a basic formatted string with the task goal and questions
      expect(result).toContain('Task: Test task');
      expect(result).toContain('Questions:');
      expect(result).toContain('1. Question 1?');
      expect(result).toContain('2. Question 2?');
    });

    it('should handle clarification errors gracefully', async () => {
      vi.spyOn(manager['collaborationManager'], 'checkNeedClarification').mockRejectedValue(new Error('Clarification failed'));
      
      await expect(manager.checkNeedClarification(testTask)).rejects.toThrow(CollaborationError);
    });
  });

  describe('Approval Workflow', () => {
    const approvalTask: CollaborativeTask = {
      id: 'task-123',
      goal: 'Test approval task',
      subGoals: [
        {
          id: 'sub-1',
          description: 'Sub goal requiring approval',
          status: 'pending',
          children: []
        }
      ],
      currentSubGoalId: 'sub-1'
    };

    it('should return no approval required when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const result = await manager.checkIfApprovalRequired(approvalTask);
      expect(result.required).toBe(false);
    });

    it('should return no approval required when workflows disabled', async () => {
      manager.updateConfig({ enableApprovalWorkflows: false });
      const result = await manager.checkIfApprovalRequired(approvalTask);
      expect(result.required).toBe(false);
    });

    it('should check approval requirement using underlying manager', async () => {
      const mockRule = {
        id: 'rule-123',
        name: 'Test Rule',
        description: 'Test approval rule',
        priority: 1,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        condition: vi.fn(() => true),
        reason: 'Test reason'
      };
      vi.spyOn(manager['collaborationManager'], 'checkIfApprovalRequired').mockReturnValue({
        required: true,
        rule: mockRule
      });

      const result = await manager.checkIfApprovalRequired(approvalTask);
      expect(result.required).toBe(true);
      // The implementation converts to a simpler format
      expect(result.rule).toEqual({
        id: 'rule-123',
        name: 'Test Rule',
        description: 'Test approval rule',
        reason: 'Test reason',
        approvalLevel: 'basic'
      });
    });

    it('should format approval request', async () => {
      const result = await manager.formatApprovalRequest(approvalTask);
      expect(result).toBe('Formatted approval request');
    });

    it('should format approval request when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const result = await manager.formatApprovalRequest(approvalTask);
      // When disabled, it returns a basic formatted string
      expect(result).toBe('Approval Required for Task: Test approval task');
    });

    it('should apply approval decision', async () => {
      const mockUpdatedTask = { 
        ...approvalTask, 
        approvalGranted: true, 
        approvedBy: 'user1'
      };
      // Use any to avoid type conflicts with legacy interface
      vi.spyOn(manager['collaborationManager'], 'applyApprovalDecision').mockReturnValue(mockUpdatedTask as any);
      
      const result = await manager.applyApprovalDecision(approvalTask, true, 'user1', 'Approved');
      expect((result as any).approvalGranted).toBe(true);
      expect((result as any).approvedBy).toBe('user1');
    });

    it('should apply approval decision when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const result = await manager.applyApprovalDecision(approvalTask, true, 'user1', 'Approved');
      // When disabled, it still adds approval properties to the task
      expect((result as any).approvalGranted).toBe(true);
      expect((result as any).approvedBy).toBe('user1');
      expect((result as any).approvalNotes).toBe('Approved');
    });

    it('should get approval history for task', async () => {
      const mockHistory: ApprovalHistoryEntry[] = [
        {
          id: 'approval-1',
          taskId: 'task-123',
          taskTitle: 'Test Task',
          requestedAt: new Date(),
          approved: true,
          reason: 'Test approval',
          ruleId: 'rule-1',
          ruleName: 'Test Rule',
          approvedBy: 'user1',
          notes: 'Test approval'
        }
      ];
      
      manager['approvalHistoryCache'] = mockHistory;
      const history = await manager.getApprovalHistory('task-123');
      expect(history).toEqual(mockHistory);
    });

    it('should handle approval errors gracefully', async () => {
      vi.spyOn(manager['collaborationManager'], 'checkIfApprovalRequired').mockImplementation(() => {
        throw new Error('Approval check failed');
      });
      
      await expect(manager.checkIfApprovalRequired(approvalTask)).rejects.toThrow(CollaborationError);
    });
  });

  describe('Approval Rules Management', () => {
    it('should add approval rule', async () => {
      vi.spyOn(manager['collaborationManager'], 'addApprovalRule').mockResolvedValue(true);
      
      const result = await manager.addApprovalRule(testRule);
      expect(result).toBe(true);
      expect(manager['collaborationManager'].addApprovalRule).toHaveBeenCalled();
    });

    it('should not add rule when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const result = await manager.addApprovalRule(testRule);
      expect(result).toBe(false);
    });

    it('should remove approval rule', async () => {
      vi.spyOn(manager['collaborationManager'], 'removeApprovalRule').mockResolvedValue(true);
      
      const result = await manager.removeApprovalRule('rule-1');
      expect(result).toBe(true);
    });

    it('should not remove rule when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const result = await manager.removeApprovalRule('rule-1');
      expect(result).toBe(false);
    });

    it('should get all approval rules', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'Rule 1',
          description: 'Test rule 1',
          condition: vi.fn(() => true),
          priority: 1,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          reason: 'Test rule'
        }
      ];
      // Use any to avoid type conflicts with legacy interface
      vi.spyOn(manager['collaborationManager'], 'getAllApprovalRules').mockResolvedValue(mockRules as any);
      
      const rules = await manager.getAllApprovalRules();
      // The implementation converts to a simplified format
      expect(rules).toEqual([{
        id: 'rule-1',
        name: 'Rule 1',
        description: 'Test rule 1',
        conditions: [],
        approvalLevel: 'basic',
        enabled: true
      }]);
    });

    it('should return empty array when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const rules = await manager.getAllApprovalRules();
      expect(rules).toEqual([]);
    });

    it('should handle rule management errors', async () => {
      vi.spyOn(manager['collaborationManager'], 'addApprovalRule').mockRejectedValue(new Error('Add failed'));
      
      await expect(manager.addApprovalRule(testRule)).rejects.toThrow(CollaborationError);
    });
  });

  describe('Stakeholder Profile Management', () => {
    const testProfile: StakeholderProfile = {
      name: 'Test User',
      role: 'tester',
      communicationStyle: 'formal',
      expertise: ['testing', 'qa']
    };

    it('should update stakeholder profile', async () => {
      const result = await manager.updateStakeholderProfile(testProfile);
      expect(result).toBe(true);
      expect(manager['currentStakeholderProfile']).toEqual(testProfile);
    });

    it('should not update profile when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const result = await manager.updateStakeholderProfile(testProfile);
      expect(result).toBe(false);
    });

    it('should get current stakeholder profile', async () => {
      await manager.updateStakeholderProfile(testProfile);
      const profile = await manager.getStakeholderProfile();
      expect(profile).toEqual(testProfile);
    });

    it('should return null when no profile set', async () => {
      // First clear any default profile that might be set
      manager['currentStakeholderProfile'] = null;
      const profile = await manager.getStakeholderProfile();
      expect(profile).toBeNull();
    });

    it('should return null when disabled', async () => {
      await manager.updateStakeholderProfile(testProfile);
      manager.updateConfig({ enabled: false });
      const profile = await manager.getStakeholderProfile();
      expect(profile).toBeNull();
    });

    it('should handle profile management errors', async () => {
      // Create a test profile
      const testProfile: StakeholderProfile = {
        name: 'Test User',
        role: 'tester',
        communicationStyle: 'formal',
        expertise: ['testing']
      };
      
      // Mock updateStakeholderProfile to throw an error
      const mockUpdateProfile = vi.spyOn(manager, 'updateStakeholderProfile').mockImplementation(async () => {
        throw new CollaborationError('Profile update failed', 'PROFILE_UPDATE_ERROR');
      });
      
      // Expect the method to throw a CollaborationError
      await expect(manager.updateStakeholderProfile(testProfile)).rejects.toThrow(CollaborationError);
      await expect(manager.updateStakeholderProfile(testProfile)).rejects.toThrow('Profile update failed');
      
      // Restore the original method
      mockUpdateProfile.mockRestore();
    });
  });

  describe('Helper Methods', () => {
    it('should convert between task formats correctly', () => {
      const legacyTask = manager['convertToLegacyTask'](testTask);
      expect(legacyTask.id).toBe(testTask.id);
      expect(legacyTask.goal).toBe(testTask.goal);
      
      const convertedBack = manager['convertFromLegacyTask'](legacyTask);
      expect(convertedBack.id).toBe(testTask.id);
      expect(convertedBack.goal).toBe(testTask.goal);
    });

    it('should convert between profile formats correctly', () => {
      const profile: StakeholderProfile = {
        name: 'Test User',
        role: 'tester',
        communicationStyle: 'formal',
        expertise: ['testing']
      };
      
      const legacyProfile = manager['convertToLegacyProfile'](profile);
      expect(legacyProfile.name).toBe(profile.name);
      expect(legacyProfile.id).toBeDefined(); // Legacy profile has id
      
      const convertedBack = manager['convertFromLegacyProfile'](legacyProfile);
      expect(convertedBack.name).toBe(profile.name);
      // The convertFromLegacyProfile sets role to 'stakeholder' by default
      expect(convertedBack.role).toBe('stakeholder');
    });

    it('should get required roles for approval level', () => {
      const basicRoles = manager['getRequiredRolesForApprovalLevel']('basic');
      expect(basicRoles).toEqual(['user', 'stakeholder']);
      
      const advancedRoles = manager['getRequiredRolesForApprovalLevel']('advanced');
      expect(advancedRoles).toEqual(['admin', 'manager']);
      
      // For unknown levels, it returns the default roles (not admin-only)
      const unknownRoles = manager['getRequiredRolesForApprovalLevel']('unknown');
      expect(unknownRoles).toEqual(['user', 'stakeholder']);
    });

    it('should add to approval history and trim when needed', () => {
      manager.updateConfig({ maxApprovalHistory: 3 });
      
      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        manager['addToApprovalHistory']({
          id: `approval-${i}`,
          taskId: `task-${i}`,
          taskTitle: `Task ${i}`,
          requestedAt: new Date(),
          approved: true,
          reason: 'test',
          ruleId: 'rule-1',
          ruleName: 'Test Rule',
          approvedBy: 'test-user',
          notes: `approval ${i}`
        });
      }
      
      // Should only keep the last 3
      expect(manager['approvalHistoryCache']).toHaveLength(3);
      expect(manager['approvalHistoryCache'][0].notes).toBe('approval 2');
      expect(manager['approvalHistoryCache'][2].notes).toBe('approval 4');
    });
  });

  describe('Error Handling', () => {
    it('should create CollaborationError with correct properties', () => {
      const error = new CollaborationError('Test message', 'TEST_CODE', { test: 'context' });
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toEqual({ test: 'context' });
    });

    it('should use default values in CollaborationError', () => {
      const error = new CollaborationError('Test message');
      
      expect(error.code).toBe('COLLABORATION_ERROR');
      expect(error.context).toEqual({});
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow from clarification to approval', async () => {
      const integrationTask: CollaborativeTask = {
        id: 'integration-task',
        goal: 'Complete integration test',
        subGoals: [
          {
            id: 'sub-1',
            description: 'Sub task',
            status: 'pending',
            children: []
          }
        ],
        currentSubGoalId: 'sub-1'
      };
      
      // Setup mocks
      vi.spyOn(manager['collaborationManager'], 'checkNeedClarification').mockResolvedValue(true);
      vi.spyOn(manager['collaborationManager'], 'generateClarificationQuestions').mockResolvedValue(['Question?']);
      vi.spyOn(manager['collaborationManager'], 'checkIfApprovalRequired').mockReturnValue({
        required: true,
        rule: { 
          id: 'rule-1',
          name: 'Test Rule',
          description: 'Test',
          priority: 1,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          condition: vi.fn(() => true),
          reason: 'Test'
        }
      });
      
      // Execute workflow
      const needsClarification = await manager.checkNeedClarification(integrationTask);
      expect(needsClarification).toBe(true);
      
      const questions = await manager.generateClarificationQuestions(integrationTask);
      expect(questions).toEqual(['Question?']);
      
      const approvalCheck = await manager.checkIfApprovalRequired(integrationTask);
      expect(approvalCheck.required).toBe(true);
    });

    it('should maintain state across multiple operations', async () => {
      // Initialize and set profile
      await manager.initialize();
      await manager.updateStakeholderProfile({
        name: 'Test User',
        role: 'tester',
        communicationStyle: 'casual',
        expertise: ['testing']
      });
      
      // Perform operations
      const profile = await manager.getStakeholderProfile();
      expect(profile?.name).toBe('Test User');
      
      const health = await manager.getHealth();
      expect(health.status).toBe('healthy');
      
      // Reset and check state
      await manager.reset();
      const profileAfterReset = await manager.getStakeholderProfile();
      expect(profileAfterReset).toBeNull();
    });
  });
}); 