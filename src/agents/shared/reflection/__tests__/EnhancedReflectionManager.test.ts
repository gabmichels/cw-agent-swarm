/**
 * EnhancedReflectionManager.test.ts - Tests for the EnhancedReflectionManager implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedReflectionManager } from '../managers/EnhancedReflectionManager';
import { ReflectionTrigger } from '../../base/managers/ReflectionManager.interface';
import { ManagerType } from '../../base/managers/ManagerType';
import { ImprovementAreaType, ImprovementPriority, LearningOutcomeType } from '../interfaces/SelfImprovement.interface';
import { PeriodicTaskStatus, PeriodicTaskType } from '../../tasks/PeriodicTaskRunner.interface';

// Mock the dependencies
vi.mock('../../base/managers/BaseManager');
vi.mock('./DefaultReflectionManager');
vi.mock('../../tasks/DefaultPeriodicTaskRunner');

// Test agent mock
const mockAgent = {
  getAgentId: vi.fn().mockReturnValue('test-agent'),
  getName: vi.fn().mockReturnValue('Test Agent'),
  getManager: vi.fn()
};

describe('EnhancedReflectionManager', () => {
  let manager: EnhancedReflectionManager;
  
  beforeEach(async () => {
    // Create a fresh manager instance for each test
    manager = new EnhancedReflectionManager(mockAgent as any, {
      enabled: true,
      adaptiveBehavior: true,
      enablePeriodicReflections: true,
      enableSelfImprovement: true,
      reflectionDepth: 'standard'
    });
    
    // Mock initialization
    manager.initialize = vi.fn().mockResolvedValue(true);
    
    // Initialize manager
    await manager.initialize();
    
    // Set initialized flag directly since mocking doesn't set it
    // @ts-ignore - Accessing private property for testing
    manager.initialized = true;
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  // Basic manager tests
  describe('Basic manager functionality', () => {
    it('should be created with the correct manager type', () => {
      expect(manager.managerType).toBe(ManagerType.REFLECTION);
    });
    
    it('should be initialized successfully', async () => {
      expect(manager.initialize).toHaveBeenCalled();
      expect(manager.isEnabled()).toBe(true);
    });
    
    it('should be enabled by default', () => {
      expect(manager.isEnabled()).toBe(true);
    });
  });
  
  // Self-improvement plan tests
  describe('Self-improvement plans', () => {
    it('should create and retrieve a self-improvement plan', async () => {
      const plan = await manager.createImprovementPlan({
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000), // Tomorrow
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
        status: 'active',
        priority: ImprovementPriority.HIGH,
        progress: 0,
        successMetrics: ['accuracy', 'efficiency'],
        successCriteria: ['Improved performance']
      });
      
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('createdAt');
      expect(plan).toHaveProperty('updatedAt');
      expect(plan.name).toBe('Test Plan');
      
      // Retrieve the plan
      const retrievedPlan = await manager.getImprovementPlan(plan.id);
      expect(retrievedPlan).not.toBeNull();
      expect(retrievedPlan?.id).toBe(plan.id);
    });
    
    it('should update a self-improvement plan', async () => {
      // Create a plan
      const plan = await manager.createImprovementPlan({
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000), // Tomorrow
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active',
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      });
      
      // Update the plan
      const updatedPlan = await manager.updateImprovementPlan(plan.id, {
        name: 'Updated Plan',
        priority: ImprovementPriority.HIGH,
        progress: 0.5
      });
      
      expect(updatedPlan.name).toBe('Updated Plan');
      expect(updatedPlan.priority).toBe(ImprovementPriority.HIGH);
      expect(updatedPlan.progress).toBe(0.5);
      expect(updatedPlan.updatedAt).not.toEqual(plan.updatedAt);
    });
    
    it('should list improvement plans with filtering', async () => {
      // Create multiple plans
      await manager.createImprovementPlan({
        name: 'Plan 1',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active',
        priority: ImprovementPriority.HIGH,
        progress: 0.2,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      });
      
      await manager.createImprovementPlan({
        name: 'Plan 2',
        description: 'Another test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-2'],
        targetAreas: [ImprovementAreaType.SKILL],
        status: 'paused',
        priority: ImprovementPriority.MEDIUM,
        progress: 0.5,
        successMetrics: ['efficiency'],
        successCriteria: ['Improved efficiency']
      });
      
      // List all plans
      const allPlans = await manager.listImprovementPlans();
      expect(allPlans.length).toBe(2);
      
      // Filter by status
      const activePlans = await manager.listImprovementPlans({ status: ['active'] });
      expect(activePlans.length).toBe(1);
      expect(activePlans[0].name).toBe('Plan 1');
      
      // Filter by priority
      const highPriorityPlans = await manager.listImprovementPlans({ priority: [ImprovementPriority.HIGH] });
      expect(highPriorityPlans.length).toBe(1);
      expect(highPriorityPlans[0].name).toBe('Plan 1');
      
      // Filter by progress
      const progressPlans = await manager.listImprovementPlans({ minProgress: 0.3 });
      expect(progressPlans.length).toBe(1);
      expect(progressPlans[0].name).toBe('Plan 2');
    });
  });
  
  // Learning activity tests
  describe('Learning activities', () => {
    let planId: string;
    
    beforeEach(async () => {
      // Create a plan for activities
      const plan = await manager.createImprovementPlan({
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
        status: 'active',
        priority: ImprovementPriority.HIGH,
        progress: 0,
        successMetrics: ['accuracy', 'efficiency'],
        successCriteria: ['Improved performance']
      });
      
      planId = plan.id;
    });
    
    it('should create and retrieve a learning activity', async () => {
      const activity = await manager.createLearningActivity({
        planId,
        name: 'Test Activity',
        description: 'A test learning activity',
        type: 'study',
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'pending',
        expectedDurationMs: 3600000,
        resources: ['test-resource-1']
      });
      
      expect(activity).toHaveProperty('id');
      expect(activity.name).toBe('Test Activity');
      
      // Retrieve the activity
      const retrievedActivity = await manager.getLearningActivity(activity.id);
      expect(retrievedActivity).not.toBeNull();
      expect(retrievedActivity?.id).toBe(activity.id);
    });
    
    it('should update a learning activity', async () => {
      // Create an activity
      const activity = await manager.createLearningActivity({
        planId,
        name: 'Test Activity',
        description: 'A test learning activity',
        type: 'study',
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'pending',
        expectedDurationMs: 3600000,
        resources: ['test-resource-1']
      });
      
      // Update the activity
      const updatedActivity = await manager.updateLearningActivity(activity.id, {
        name: 'Updated Activity',
        status: 'in_progress'
      });
      
      expect(updatedActivity.name).toBe('Updated Activity');
      expect(updatedActivity.status).toBe('in_progress');
    });
    
    it('should list learning activities with filtering', async () => {
      // Create multiple activities
      await manager.createLearningActivity({
        planId,
        name: 'Activity 1',
        description: 'A test learning activity',
        type: 'study',
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'in_progress',
        expectedDurationMs: 3600000,
        resources: ['test-resource-1']
      });
      
      await manager.createLearningActivity({
        planId,
        name: 'Activity 2',
        description: 'Another test learning activity',
        type: 'practice',
        area: ImprovementAreaType.SKILL,
        status: 'completed',
        expectedDurationMs: 1800000,
        resources: ['test-resource-2']
      });
      
      // List all activities
      const allActivities = await manager.listLearningActivities({ planId });
      expect(allActivities.length).toBe(2);
      
      // Filter by status
      const inProgressActivities = await manager.listLearningActivities({ 
        planId,
        status: ['in_progress'] 
      });
      expect(inProgressActivities.length).toBe(1);
      expect(inProgressActivities[0].name).toBe('Activity 1');
      
      // Filter by type
      const practiceActivities = await manager.listLearningActivities({ 
        planId,
        type: ['practice'] 
      });
      expect(practiceActivities.length).toBe(1);
      expect(practiceActivities[0].name).toBe('Activity 2');
      
      // Filter by area
      const skillActivities = await manager.listLearningActivities({ 
        planId,
        area: [ImprovementAreaType.SKILL] 
      });
      expect(skillActivities.length).toBe(1);
      expect(skillActivities[0].name).toBe('Activity 2');
    });
    
    it('should update plan progress when activity status changes', async () => {
      // Create two activities
      await manager.createLearningActivity({
        planId,
        name: 'Activity 1',
        description: 'A test learning activity',
        type: 'study',
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'pending',
        expectedDurationMs: 3600000,
        resources: ['test-resource-1']
      });
      
      const activity2 = await manager.createLearningActivity({
        planId,
        name: 'Activity 2',
        description: 'Another test learning activity',
        type: 'practice',
        area: ImprovementAreaType.SKILL,
        status: 'pending',
        expectedDurationMs: 1800000,
        resources: ['test-resource-2']
      });
      
      // Update one activity to completed
      await manager.updateLearningActivity(activity2.id, {
        status: 'completed'
      });
      
      // Check plan progress
      const plan = await manager.getImprovementPlan(planId);
      expect(plan?.progress).toBeGreaterThan(0);
    });
  });
  
  // Learning outcome tests
  describe('Learning outcomes', () => {
    let planId: string;
    
    beforeEach(async () => {
      // Create a plan for outcomes
      const plan = await manager.createImprovementPlan({
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
        status: 'active',
        priority: ImprovementPriority.HIGH,
        progress: 0,
        successMetrics: ['accuracy', 'efficiency'],
        successCriteria: ['Improved performance']
      });
      
      planId = plan.id;
    });
    
    it('should record and retrieve a learning outcome', async () => {
      const outcome = await manager.recordLearningOutcome({
        planId,
        type: LearningOutcomeType.KNOWLEDGE,
        content: 'Test learning outcome',
        source: 'reflection',
        sourceId: 'reflection-1',
        confidence: 0.8,
        affectedAreas: [ImprovementAreaType.KNOWLEDGE],
        appliedToBehavior: false
      });
      
      expect(outcome).toHaveProperty('id');
      expect(outcome).toHaveProperty('timestamp');
      expect(outcome.content).toBe('Test learning outcome');
      
      // Retrieve the outcome
      const retrievedOutcome = await manager.getLearningOutcome(outcome.id);
      expect(retrievedOutcome).not.toBeNull();
      expect(retrievedOutcome?.id).toBe(outcome.id);
    });
    
    it('should update a learning outcome', async () => {
      // Record an outcome
      const outcome = await manager.recordLearningOutcome({
        planId,
        type: LearningOutcomeType.KNOWLEDGE,
        content: 'Test learning outcome',
        source: 'reflection',
        sourceId: 'reflection-1',
        confidence: 0.8,
        affectedAreas: [ImprovementAreaType.KNOWLEDGE],
        appliedToBehavior: false
      });
      
      // Update the outcome
      const updatedOutcome = await manager.updateLearningOutcome(outcome.id, {
        content: 'Updated learning outcome',
        confidence: 0.9,
        appliedToBehavior: true
      });
      
      expect(updatedOutcome.content).toBe('Updated learning outcome');
      expect(updatedOutcome.confidence).toBe(0.9);
      expect(updatedOutcome.appliedToBehavior).toBe(true);
    });
    
    it('should list learning outcomes with filtering', async () => {
      // Record multiple outcomes
      await manager.recordLearningOutcome({
        planId,
        type: LearningOutcomeType.KNOWLEDGE,
        content: 'Knowledge outcome',
        source: 'reflection',
        sourceId: 'reflection-1',
        confidence: 0.8,
        affectedAreas: [ImprovementAreaType.KNOWLEDGE],
        appliedToBehavior: false
      });
      
      await manager.recordLearningOutcome({
        planId,
        type: LearningOutcomeType.SKILL,
        content: 'Skill outcome',
        source: 'practice',
        sourceId: 'activity-1',
        confidence: 0.7,
        affectedAreas: [ImprovementAreaType.SKILL],
        appliedToBehavior: true
      });
      
      // List all outcomes
      const allOutcomes = await manager.listLearningOutcomes({ planId });
      expect(allOutcomes.length).toBe(2);
      
      // Filter by type
      const knowledgeOutcomes = await manager.listLearningOutcomes({ 
        planId,
        type: [LearningOutcomeType.KNOWLEDGE] 
      });
      expect(knowledgeOutcomes.length).toBe(1);
      expect(knowledgeOutcomes[0].content).toBe('Knowledge outcome');
      
      // Filter by area
      const skillOutcomes = await manager.listLearningOutcomes({ 
        planId,
        area: [ImprovementAreaType.SKILL] 
      });
      expect(skillOutcomes.length).toBe(1);
      expect(skillOutcomes[0].content).toBe('Skill outcome');
      
      // Filter by applied status
      const appliedOutcomes = await manager.listLearningOutcomes({ 
        planId,
        appliedToBehavior: true 
      });
      expect(appliedOutcomes.length).toBe(1);
      expect(appliedOutcomes[0].content).toBe('Skill outcome');
      
      // Filter by confidence
      const highConfidenceOutcomes = await manager.listLearningOutcomes({ 
        planId,
        minConfidence: 0.75 
      });
      expect(highConfidenceOutcomes.length).toBe(1);
      expect(highConfidenceOutcomes[0].content).toBe('Knowledge outcome');
    });
    
    it('should apply learning outcomes to behavior', async () => {
      // Record an outcome
      const outcome = await manager.recordLearningOutcome({
        planId,
        type: LearningOutcomeType.KNOWLEDGE,
        content: 'Test learning outcome',
        source: 'reflection',
        sourceId: 'reflection-1',
        confidence: 0.8,
        affectedAreas: [ImprovementAreaType.KNOWLEDGE],
        appliedToBehavior: false
      });
      
      // Apply the outcome
      const result = await manager.applyLearningOutcomes([outcome.id]);
      expect(result).toBe(true);
      
      // Check that the outcome is marked as applied
      const updatedOutcome = await manager.getLearningOutcome(outcome.id);
      expect(updatedOutcome?.appliedToBehavior).toBe(true);
      expect(updatedOutcome?.appliedAt).toBeDefined();
    });
  });
  
  // Progress report tests
  describe('Progress reports', () => {
    let planId: string;
    
    beforeEach(async () => {
      // Create a plan for the report
      const plan = await manager.createImprovementPlan({
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
        status: 'active',
        priority: ImprovementPriority.HIGH,
        progress: 0,
        successMetrics: ['accuracy', 'efficiency'],
        successCriteria: ['Improved performance']
      });
      
      planId = plan.id;
      
      // Add activities
      await manager.createLearningActivity({
        planId,
        name: 'Activity 1',
        description: 'Knowledge activity',
        type: 'study',
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'completed',
        expectedDurationMs: 3600000,
        resources: ['test-resource-1']
      });
      
      await manager.createLearningActivity({
        planId,
        name: 'Activity 2',
        description: 'Skill activity',
        type: 'practice',
        area: ImprovementAreaType.SKILL,
        status: 'in_progress',
        expectedDurationMs: 1800000,
        resources: ['test-resource-2']
      });
      
      // Add outcomes
      await manager.recordLearningOutcome({
        planId,
        type: LearningOutcomeType.KNOWLEDGE,
        content: 'Knowledge outcome',
        source: 'reflection',
        sourceId: 'reflection-1',
        confidence: 0.8,
        affectedAreas: [ImprovementAreaType.KNOWLEDGE],
        appliedToBehavior: true
      });
    });
    
    it('should generate a progress report', async () => {
      const report = await manager.generateProgressReport(planId, {
        includeActivities: true,
        includeOutcomes: true,
        includeMetrics: true,
        includeRecommendations: true
      });
      
      expect(report).toHaveProperty('planId');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('overallProgress');
      expect(report).toHaveProperty('progressByArea');
      expect(report).toHaveProperty('activeActivities');
      expect(report).toHaveProperty('completedActivities');
      expect(report).toHaveProperty('outcomes');
      expect(report).toHaveProperty('challenges');
      expect(report).toHaveProperty('recommendations');
      
      // Check that the progress by area is calculated correctly
      expect(report.progressByArea[ImprovementAreaType.KNOWLEDGE]).toBe(100);
      expect(report.progressByArea[ImprovementAreaType.SKILL]).toBe(0);
      
      // Check active activities
      expect(report.activeActivities?.length).toBe(1);
      expect(report.activeActivities?.[0].area).toBe(ImprovementAreaType.SKILL);
      
      // Check completed activities
      expect(report.completedActivities?.length).toBe(1);
      expect(report.completedActivities?.[0].area).toBe(ImprovementAreaType.KNOWLEDGE);
      
      // Check outcomes
      expect(report.outcomes?.length).toBe(1);
    });
  });
  
  // Periodic reflection tests
  describe('Periodic reflections', () => {
    it('should schedule a periodic reflection', async () => {
      const task = await manager.schedulePeriodicReflection('0 0 * * *', {
        name: 'Daily Reflection',
        depth: 'standard',
        focusAreas: ['knowledge', 'planning']
      });
      
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('schedule');
      expect(task.name).toBe('Daily Reflection');
      expect(task.enabled).toBe(true);
      expect(task.parameters.depth).toBe('standard');
      expect(task.parameters.focusAreas).toEqual(['knowledge', 'planning']);
    });
    
    it('should retrieve a periodic reflection task', async () => {
      // Schedule a task
      const task = await manager.schedulePeriodicReflection('0 0 * * *', {
        name: 'Daily Reflection'
      });
      
      // Retrieve the task
      const retrievedTask = await manager.getPeriodicReflectionTask(task.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask?.id).toBe(task.id);
    });
    
    it('should update a periodic reflection task', async () => {
      // Create a mock task
      const mockTask = {
        id: 'task-1',
        name: 'Test Task',
        type: PeriodicTaskType.CUSTOM,
        nextRunTime: new Date(),
        status: PeriodicTaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: true,
        parameters: {
          depth: 'standard' as const,
          focusAreas: ['knowledge'],
          strategies: [],
          context: {}
        }
      };

      // Mock methods
      manager.schedulePeriodicReflection = vi.fn().mockResolvedValue(mockTask);
      manager.updatePeriodicReflectionTask = vi.fn().mockImplementation((id, updates) => {
        return Promise.resolve({
          ...mockTask,
          ...updates,
          name: updates.name || mockTask.name,
          enabled: updates.enabled !== undefined ? updates.enabled : mockTask.enabled,
          parameters: {
            ...mockTask.parameters,
            ...(updates.parameters || {})
          },
          updatedAt: new Date()
        });
      });
      
      // Schedule a task
      const task = await manager.schedulePeriodicReflection('0 0 * * *', {
        name: 'Test Reflection'
      });
      
      // Update the task
      const updatedTask = await manager.updatePeriodicReflectionTask(task.id, {
        name: 'Updated Reflection',
        enabled: false,
        parameters: {
          depth: 'deep' as const,
          focusAreas: ['knowledge', 'planning'],
          strategies: ['strategy-1'],
          context: { priority: 'high' }
        }
      });
      
      expect(updatedTask.name).toBe('Updated Reflection');
      expect(updatedTask.enabled).toBe(false);
      expect(updatedTask.parameters.depth).toBe('deep');
      expect(updatedTask.parameters.focusAreas).toEqual(['knowledge', 'planning']);
      expect(updatedTask.parameters.strategies).toEqual(['strategy-1']);
      expect(updatedTask.parameters.context).toEqual({ priority: 'high' });
    });
    
    it('should list periodic reflection tasks with filtering', async () => {
      // Schedule multiple tasks
      await manager.schedulePeriodicReflection('0 0 * * *', {
        name: 'Daily Reflection',
        depth: 'light'
      });
      
      await manager.schedulePeriodicReflection('0 0 * * 1', {
        name: 'Weekly Reflection',
        depth: 'deep'
      });
      
      // Disable one task
      const tasks = await manager.listPeriodicReflectionTasks();
      await manager.setPeriodicReflectionTaskEnabled(tasks[1].id, false);
      
      // List all tasks
      const allTasks = await manager.listPeriodicReflectionTasks();
      expect(allTasks.length).toBe(2);
      
      // Filter by enabled status
      const enabledTasks = await manager.listPeriodicReflectionTasks({ enabled: true });
      expect(enabledTasks.length).toBe(1);
      expect(enabledTasks[0].name).toBe('Daily Reflection');
      
      // Filter by status
      const scheduledTasks = await manager.listPeriodicReflectionTasks({ 
        status: [PeriodicTaskStatus.PENDING] 
      });
      expect(scheduledTasks.length).toBe(2);
      
      // Sort by name
      const sortedTasks = await manager.listPeriodicReflectionTasks({ 
        sortBy: 'name',
        sortDirection: 'asc'
      });
      expect(sortedTasks[0].name).toBe('Daily Reflection');
      expect(sortedTasks[1].name).toBe('Weekly Reflection');
    });
    
    it('should run a periodic reflection task', async () => {
      // Schedule a task
      const task = await manager.schedulePeriodicReflection('0 0 * * *', {
        name: 'Test Reflection'
      });
      
      // Mock the reflect method
      // @ts-ignore - Accessing private property for testing
      manager.reflect = vi.fn().mockResolvedValue({
        success: true,
        id: 'reflection-123',
        insights: [{ id: 'insight-1' }, { id: 'insight-2' }],
        message: 'Reflection completed'
      });
      
      // Run the task
      const result = await manager.runPeriodicReflectionTask(task.id, {
        context: { test: true }
      });
      
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      
      // Handle the result object type correctly
      const resultData = result.result as Record<string, unknown>;
      expect(resultData.reflectionId).toBe('reflection-123');
      expect(resultData.insightCount).toBe(2);
      
      // Check that reflect was called with the right params
      expect(manager.reflect).toHaveBeenCalledWith('periodic', expect.objectContaining({
        taskId: task.id,
        taskName: 'Test Reflection',
        scheduled: true,
        test: true
      }));
    });
    
    it('should delete a periodic reflection task', async () => {
      // Schedule a task
      const task = await manager.schedulePeriodicReflection('0 0 * * *', {
        name: 'Test Reflection'
      });
      
      // Delete the task
      const result = await manager.deletePeriodicReflectionTask(task.id);
      expect(result).toBe(true);
      
      // Try to retrieve the deleted task
      const retrievedTask = await manager.getPeriodicReflectionTask(task.id);
      expect(retrievedTask).toBeNull();
    });
  });
  
  // Plan generation tests
  describe('Plan generation', () => {
    it('should generate a plan from reflections', async () => {
      // Mock reflections
      // @ts-ignore - Accessing private property for testing
      manager.getReflection = vi.fn().mockImplementation((id) => {
        return {
          id,
          timestamp: new Date(),
          trigger: 'manual' as ReflectionTrigger,
          context: {},
          depth: 'standard',
          insights: ['insight-1', 'insight-2'],
          metrics: {}
        };
      });
      
      // Mock insights
      // @ts-ignore - Accessing private property for testing
      manager.getInsights = vi.fn().mockResolvedValue([
        {
          id: 'insight-1',
          reflectionId: 'reflection-1',
          timestamp: new Date(),
          type: 'improvement',
          content: 'Test insight 1',
          confidence: 0.9,
          metadata: {}
        },
        {
          id: 'insight-2',
          reflectionId: 'reflection-1',
          timestamp: new Date(),
          type: 'learning',
          content: 'Test insight 2',
          confidence: 0.8,
          metadata: {}
        }
      ]);
      
      // Generate a plan
      const plan = await manager.generateImprovementPlanFromReflections(['reflection-1'], {
        focusAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL]
      });
      
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('description');
      expect(plan.sourceReflectionIds).toEqual(['reflection-1']);
      expect(plan.targetAreas).toEqual([ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL]);
      expect(plan.status).toBe('active');
      expect(plan.progress).toBe(0);
    });
  });
}); 
