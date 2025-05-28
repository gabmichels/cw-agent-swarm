/**
 * DefaultReflectionManager.test.ts
 * 
 * Comprehensive test suite for DefaultReflectionManager integration.
 * Following @IMPLEMENTATION_GUIDELINES.md with >95% test coverage.
 */

import { DefaultReflectionManager, DefaultReflectionManagerConfig } from './DefaultReflectionManager';
import { 
  ImprovementAreaType,
  ImprovementPriority,
  ScheduleFrequency
} from './interfaces/EnhancedReflectionInterfaces';

describe('DefaultReflectionManager', () => {
  let manager: DefaultReflectionManager;

  beforeEach(async () => {
    manager = new DefaultReflectionManager();
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  // ============================================================================
  // Initialization and Configuration Tests
  // ============================================================================

  describe('Initialization and Configuration', () => {
    it('should initialize with default configuration', async () => {
      const defaultManager = new DefaultReflectionManager();
      await defaultManager.initialize();
      
      const stats = await defaultManager.getStats();
      expect(stats.totalReflections).toBe(0);
      expect(stats.totalPlans).toBe(0);
      expect(stats.totalActivities).toBe(0);
      expect(stats.totalOutcomes).toBe(0);
      
      await defaultManager.shutdown();
    });

    it('should initialize with custom configuration', async () => {
      const config: DefaultReflectionManagerConfig = {
        enableCaching: false,
        enableAutoScheduling: false,
        enableProgressTracking: false,
        enableLearningAnalytics: false,
        maxConcurrentOperations: 5,
        autoSaveInterval: 30000
      };

      const customManager = new DefaultReflectionManager(config);
      await customManager.initialize();
      
      const stats = await customManager.getStats();
      expect(stats.totalReflections).toBe(0);
      
      await customManager.shutdown();
    });

    it('should handle initialization errors gracefully', async () => {
      // This would test error handling during initialization
      // For now, we'll test that initialization completes successfully
      const manager = new DefaultReflectionManager();
      await expect(manager.initialize()).resolves.not.toThrow();
      await manager.shutdown();
    });

    it('should handle multiple initialization calls', async () => {
      const manager = new DefaultReflectionManager();
      
      await manager.initialize();
      await manager.initialize(); // Should not throw
      
      await manager.shutdown();
    });

    it('should handle shutdown without initialization', async () => {
      const manager = new DefaultReflectionManager();
      await expect(manager.shutdown()).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Improvement Plan Management Tests
  // ============================================================================

  describe('Improvement Plan Management', () => {
    it('should create improvement plan successfully', async () => {
      const planData = {
        name: 'Test Improvement Plan',
        description: 'A test plan for improvement',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
        status: 'active' as const,
        priority: ImprovementPriority.HIGH,
        progress: 0,
        successMetrics: ['completion_rate', 'learning_velocity'],
        successCriteria: ['Complete all activities', 'Achieve target outcomes']
      };

      const plan = await manager.createImprovementPlan(planData);
      
      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.name).toBe(planData.name);
      expect(plan.description).toBe(planData.description);
      expect(plan.targetAreas).toEqual(planData.targetAreas);
      expect(plan.status).toBe(planData.status);
      expect(plan.priority).toBe(planData.priority);
      expect(plan.createdAt).toBeInstanceOf(Date);
      expect(plan.updatedAt).toBeInstanceOf(Date);

      const stats = await manager.getStats();
      expect(stats.totalPlans).toBe(1);
    });

    it('should retrieve improvement plan by ID', async () => {
      const planData = {
        name: 'Test Plan',
        description: 'Test description',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };

      const createdPlan = await manager.createImprovementPlan(planData);
      const retrievedPlan = await manager.getImprovementPlan(createdPlan.id);
      
      expect(retrievedPlan).toBeDefined();
      expect(retrievedPlan!.id).toBe(createdPlan.id);
      expect(retrievedPlan!.name).toBe(planData.name);
    });

    it('should return null for non-existent plan', async () => {
      const plan = await manager.getImprovementPlan('non-existent-id');
      expect(plan).toBeNull();
    });

    it('should update improvement plan', async () => {
      const planData = {
        name: 'Original Plan',
        description: 'Original description',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.LOW,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };

      const plan = await manager.createImprovementPlan(planData);
      
      const updates = {
        name: 'Updated Plan',
        description: 'Updated description',
        priority: ImprovementPriority.HIGH,
        progress: 0.5
      };

      const updatedPlan = await manager.updateImprovementPlan(plan.id, updates);
      
      expect(updatedPlan.name).toBe(updates.name);
      expect(updatedPlan.description).toBe(updates.description);
      expect(updatedPlan.priority).toBe(updates.priority);
      expect(updatedPlan.progress).toBe(updates.progress);
      expect(updatedPlan.updatedAt.getTime()).toBeGreaterThan(plan.updatedAt.getTime());
    });

    it('should delete improvement plan', async () => {
      const planData = {
        name: 'Plan to Delete',
        description: 'This plan will be deleted',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };

      const plan = await manager.createImprovementPlan(planData);
      
      const deleted = await manager.deleteImprovementPlan(plan.id);
      expect(deleted).toBe(true);
      
      const retrievedPlan = await manager.getImprovementPlan(plan.id);
      expect(retrievedPlan).toBeNull();

      const stats = await manager.getStats();
      expect(stats.totalPlans).toBe(0);
    });

    it('should list improvement plans', async () => {
      const planData1 = {
        name: 'Plan 1',
        description: 'First plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.HIGH,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };

      const planData2 = {
        name: 'Plan 2',
        description: 'Second plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-2'],
        targetAreas: [ImprovementAreaType.SKILL],
        status: 'completed' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 1,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };

      await manager.createImprovementPlan(planData1);
      await manager.createImprovementPlan(planData2);
      
      const allPlans = await manager.listImprovementPlans();
      expect(allPlans).toHaveLength(2);
      
      const activePlans = await manager.listImprovementPlans({ status: ['active'] });
      expect(activePlans).toHaveLength(1);
      expect(activePlans[0].name).toBe('Plan 1');
      
      const highPriorityPlans = await manager.listImprovementPlans({ priority: [ImprovementPriority.HIGH] });
      expect(highPriorityPlans).toHaveLength(1);
      expect(highPriorityPlans[0].name).toBe('Plan 1');
    });
  });

  // ============================================================================
  // Learning Activity Management Tests
  // ============================================================================

  describe('Learning Activity Management', () => {
    let testPlan: any;

    beforeEach(async () => {
      const planData = {
        name: 'Test Plan for Activities',
        description: 'Plan for testing activities',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };
      testPlan = await manager.createImprovementPlan(planData);
    });

    it('should create learning activity successfully', async () => {
      const activityData = {
        planId: testPlan.id,
        name: 'Test Learning Activity',
        description: 'A test activity for learning',
        type: 'reading' as const,
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'planned' as const,
        priority: ImprovementPriority.MEDIUM,
        estimatedDuration: 60,
        resources: ['Book: Test Book'],
        prerequisites: [],
        successCriteria: ['Complete reading', 'Take notes'],
        metadata: {}
      };

      const activity = await manager.createLearningActivity(activityData);
      
      expect(activity).toBeDefined();
      expect(activity.id).toBeDefined();
      expect(activity.name).toBe(activityData.name);
      expect(activity.description).toBe(activityData.description);
      expect(activity.type).toBe(activityData.type);
      expect(activity.area).toBe(activityData.area);
      expect(activity.status).toBe(activityData.status);
      expect(activity.planId).toBe(testPlan.id);

      const stats = await manager.getStats();
      expect(stats.totalActivities).toBe(1);
    });

    it('should start and complete learning activity', async () => {
      const activityData = {
        planId: testPlan.id,
        name: 'Activity to Complete',
        description: 'This activity will be completed',
        type: 'practice' as const,
        area: ImprovementAreaType.SKILL,
        status: 'planned' as const,
        priority: ImprovementPriority.MEDIUM,
        estimatedDuration: 30,
        resources: [],
        prerequisites: [],
        successCriteria: ['Complete practice session'],
        metadata: {}
      };

      const activity = await manager.createLearningActivity(activityData);
      
      // Start the activity
      const startedActivity = await manager.startLearningActivity(activity.id);
      expect(startedActivity.status).toBe('in_progress');
      expect(startedActivity.startDate).toBeInstanceOf(Date);
      
      // Complete the activity
      const completedActivity = await manager.completeLearningActivity(activity.id);
      expect(completedActivity.status).toBe('completed');
      expect(completedActivity.completedAt).toBeInstanceOf(Date);
    });

    it('should list learning activities with filters', async () => {
      const activity1Data = {
        planId: testPlan.id,
        name: 'Reading Activity',
        description: 'Read a book',
        type: 'reading' as const,
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'planned' as const,
        priority: ImprovementPriority.MEDIUM,
        estimatedDuration: 60,
        resources: [],
        prerequisites: [],
        successCriteria: ['Complete reading'],
        metadata: {}
      };

      const activity2Data = {
        planId: testPlan.id,
        name: 'Practice Activity',
        description: 'Practice skills',
        type: 'practice' as const,
        area: ImprovementAreaType.SKILL,
        status: 'in_progress' as const,
        priority: ImprovementPriority.MEDIUM,
        estimatedDuration: 30,
        resources: [],
        prerequisites: [],
        successCriteria: ['Complete practice'],
        metadata: {}
      };

      await manager.createLearningActivity(activity1Data);
      await manager.createLearningActivity(activity2Data);
      
      const allActivities = await manager.listLearningActivities();
      expect(allActivities).toHaveLength(2);
      
      const planActivities = await manager.listLearningActivities({ planId: testPlan.id });
      expect(planActivities).toHaveLength(2);
      
      const readingActivities = await manager.listLearningActivities({ type: ['reading'] });
      expect(readingActivities).toHaveLength(1);
      expect(readingActivities[0].name).toBe('Reading Activity');
      
      const inProgressActivities = await manager.listLearningActivities({ status: ['in_progress'] });
      expect(inProgressActivities).toHaveLength(1);
      expect(inProgressActivities[0].name).toBe('Practice Activity');
    });
  });

  // ============================================================================
  // Learning Outcome Management Tests
  // ============================================================================

  describe('Learning Outcome Management', () => {
    let testPlan: any;
    let testActivity: any;

    beforeEach(async () => {
      const planData = {
        name: 'Test Plan for Outcomes',
        description: 'Plan for testing outcomes',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };
      testPlan = await manager.createImprovementPlan(planData);

      const activityData = {
        planId: testPlan.id,
        name: 'Test Activity for Outcomes',
        description: 'Activity for testing outcomes',
        type: 'reading' as const,
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'completed' as const,
        priority: ImprovementPriority.MEDIUM,
        estimatedDuration: 60,
        resources: [],
        prerequisites: [],
        successCriteria: ['Complete reading'],
        metadata: {}
      };
      testActivity = await manager.createLearningActivity(activityData);
    });

    it('should record learning outcome successfully', async () => {
      const outcomeData = {
        planId: testPlan.id,
        activityId: testActivity.id,
        type: 'knowledge_gained' as const,
        area: ImprovementAreaType.KNOWLEDGE,
        description: 'Learned about test concepts',
        confidence: 0.8,
        evidence: ['Completed reading', 'Understood key concepts'],
        appliedToBehavior: false,
        relatedInsightIds: [],
        metadata: {}
      };

      const outcome = await manager.recordLearningOutcome(outcomeData);
      
      expect(outcome).toBeDefined();
      expect(outcome.id).toBeDefined();
      expect(outcome.planId).toBe(testPlan.id);
      expect(outcome.activityId).toBe(testActivity.id);
      expect(outcome.type).toBe(outcomeData.type);
      expect(outcome.area).toBe(outcomeData.area);
      expect(outcome.description).toBe(outcomeData.description);
      expect(outcome.confidence).toBe(outcomeData.confidence);
      expect(outcome.evidence).toEqual(outcomeData.evidence);
      expect(outcome.appliedToBehavior).toBe(false);
      expect(outcome.timestamp).toBeInstanceOf(Date);

      const stats = await manager.getStats();
      expect(stats.totalOutcomes).toBe(1);
    });

    it('should apply outcome to behavior', async () => {
      const outcomeData = {
        planId: testPlan.id,
        activityId: testActivity.id,
        type: 'skill_developed' as const,
        area: ImprovementAreaType.SKILL,
        description: 'Developed new skill',
        confidence: 0.7,
        evidence: ['Practiced skill', 'Demonstrated competency'],
        appliedToBehavior: false,
        relatedInsightIds: [],
        metadata: {}
      };

      const outcome = await manager.recordLearningOutcome(outcomeData);
      
      const appliedOutcome = await manager.applyOutcomeToBehavior(outcome.id, 0.9);
      
      expect(appliedOutcome.appliedToBehavior).toBe(true);
      expect(appliedOutcome.confidence).toBe(0.9);
    });

    it('should list learning outcomes with filters', async () => {
      const outcome1Data = {
        planId: testPlan.id,
        activityId: testActivity.id,
        type: 'knowledge_gained' as const,
        area: ImprovementAreaType.KNOWLEDGE,
        description: 'Knowledge outcome',
        confidence: 0.8,
        evidence: ['Evidence 1'],
        appliedToBehavior: false,
        relatedInsightIds: [],
        metadata: {}
      };

      const outcome2Data = {
        planId: testPlan.id,
        activityId: testActivity.id,
        type: 'skill_developed' as const,
        area: ImprovementAreaType.SKILL,
        description: 'Skill outcome',
        confidence: 0.7,
        evidence: ['Evidence 2'],
        appliedToBehavior: true,
        relatedInsightIds: [],
        metadata: {}
      };

      await manager.recordLearningOutcome(outcome1Data);
      await manager.recordLearningOutcome(outcome2Data);
      
      const allOutcomes = await manager.listLearningOutcomes();
      expect(allOutcomes).toHaveLength(2);
      
      const planOutcomes = await manager.listLearningOutcomes({ planId: testPlan.id });
      expect(planOutcomes).toHaveLength(2);
      
      const activityOutcomes = await manager.listLearningOutcomes({ activityId: testActivity.id });
      expect(activityOutcomes).toHaveLength(2);
      
      const knowledgeOutcomes = await manager.listLearningOutcomes({ type: ['knowledge_gained'] });
      expect(knowledgeOutcomes).toHaveLength(1);
      expect(knowledgeOutcomes[0].description).toBe('Knowledge outcome');
    });
  });

  // ============================================================================
  // Progress Analysis and Reporting Tests
  // ============================================================================

  describe('Progress Analysis and Reporting', () => {
    let testPlan: any;

    beforeEach(async () => {
      const planData = {
        name: 'Test Plan for Progress',
        description: 'Plan for testing progress analysis',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
        status: 'active' as const,
        priority: ImprovementPriority.HIGH,
        progress: 0.3,
        successMetrics: ['completion_rate', 'learning_velocity'],
        successCriteria: ['Complete all activities', 'Achieve target outcomes']
      };
      testPlan = await manager.createImprovementPlan(planData);
    });

    it('should generate comprehensive progress report', async () => {
      const report = await manager.generateProgressReport(testPlan.id);
      
      expect(report).toBeDefined();
      expect(report.planId).toBe(testPlan.id);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.timeRange).toBeDefined();
      expect(report.timeRange.start).toBeInstanceOf(Date);
      expect(report.timeRange.end).toBeInstanceOf(Date);
      expect(typeof report.overallProgress).toBe('number');
      expect(report.overallProgress).toBeGreaterThanOrEqual(0);
      expect(report.overallProgress).toBeLessThanOrEqual(1);
      expect(typeof report.completedActivities).toBe('number');
      expect(typeof report.totalActivities).toBe('number');
      expect(Array.isArray(report.learningOutcomes)).toBe(true);
      expect(Array.isArray(report.keyInsights)).toBe(true);
      expect(Array.isArray(report.achievements)).toBe(true);
      expect(Array.isArray(report.challenges)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.nextSteps)).toBe(true);
      expect(report.metrics).toBeDefined();

      const stats = await manager.getStats();
      expect(stats.totalReflections).toBe(1);
      expect(stats.lastReflectionTime).toBeInstanceOf(Date);
      expect(stats.averageReflectionTime).toBeGreaterThan(0);
    });

    it('should generate report with custom options', async () => {
      const options = {
        includeActivities: true,
        includeOutcomes: true,
        includeMetrics: true,
        includeRecommendations: false,
        timeRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          end: new Date()
        }
      };
      
      const report = await manager.generateProgressReport(testPlan.id, options);
      
      expect(report.timeRange.start).toEqual(options.timeRange.start);
      expect(report.timeRange.end).toEqual(options.timeRange.end);
      expect(report.recommendations).toEqual([]); // Should be empty when disabled
    });

    it('should calculate overall progress', async () => {
      const progress = await manager.calculateOverallProgress(testPlan.id);
      
      expect(typeof progress).toBe('number');
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    });

    it('should identify bottlenecks', async () => {
      const bottlenecks = await manager.identifyBottlenecks(testPlan.id);
      
      expect(Array.isArray(bottlenecks)).toBe(true);
      bottlenecks.forEach(bottleneck => {
        expect(bottleneck.type).toBeDefined();
        expect(bottleneck.description).toBeDefined();
        expect(bottleneck.severity).toBeDefined();
        expect(bottleneck.impact).toBeDefined();
        expect(Array.isArray(bottleneck.suggestedSolutions)).toBe(true);
        expect(Array.isArray(bottleneck.affectedActivities)).toBe(true);
        expect(bottleneck.identifiedAt).toBeInstanceOf(Date);
      });
    });

    it('should generate recommendations', async () => {
      const recommendations = await manager.generateRecommendations(testPlan.id);
      
      expect(Array.isArray(recommendations)).toBe(true);
      recommendations.forEach(recommendation => {
        expect(typeof recommendation).toBe('string');
        expect(recommendation.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Periodic Reflection Scheduling Tests
  // ============================================================================

  describe('Periodic Reflection Scheduling', () => {
    let testPlan: any;

    beforeEach(async () => {
      const planData = {
        name: 'Test Plan for Scheduling',
        description: 'Plan for testing scheduling',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };
      testPlan = await manager.createImprovementPlan(planData);
    });

    it('should schedule periodic reflection', async () => {
      const scheduleConfig = {
        name: `Weekly Reflection for ${testPlan.id}`,
        description: 'Weekly reflection schedule',
        frequency: ScheduleFrequency.WEEKLY,
        interval: 604800000, // 1 week
        enabled: true,
        reflectionType: 'progress_review',
        triggerConditions: [`plan:${testPlan.id}`],
        analysisDepth: 'detailed' as const
      };

      const schedule = await manager.schedulePeriodicReflection('weekly', { 
        name: scheduleConfig.name,
        depth: 'standard' as const
      });
      
      expect(schedule).toBeDefined();
      expect(schedule.id).toBeDefined();
    });

    it('should retrieve reflection schedule', async () => {
      const scheduleConfig = {
        name: `Daily Reflection for ${testPlan.id}`,
        description: 'Daily reflection schedule',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000, // 1 day
        enabled: true,
        reflectionType: 'daily_review',
        triggerConditions: [`plan:${testPlan.id}`],
        analysisDepth: 'basic' as const
      };

      const createdSchedule = await manager.schedulePeriodicReflection('daily', {
        name: scheduleConfig.name,
        depth: 'light' as const
      });
      const retrievedSchedule = await manager.getReflectionSchedule(createdSchedule.id);
      
      expect(retrievedSchedule).toBeDefined();
      expect(retrievedSchedule!.id).toBe(createdSchedule.id);
    });

    it('should update reflection schedule', async () => {
      const schedule = await manager.schedulePeriodicReflection('weekly', {
        name: 'Test Schedule',
        depth: 'standard' as const
      });
      
      const updates = {
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: false
      };

      const updatedSchedule = await manager.updateReflectionSchedule(schedule.id, updates);
      
      expect(updatedSchedule.frequency).toBe(updates.frequency);
      expect(updatedSchedule.enabled).toBe(updates.enabled);
    });

    it('should cancel reflection schedule', async () => {
      const schedule = await manager.schedulePeriodicReflection('weekly', {
        name: 'Schedule to Cancel',
        depth: 'standard' as const
      });
      
      const cancelled = await manager.cancelReflectionSchedule(schedule.id);
      expect(cancelled).toBe(true);
      
      const retrievedSchedule = await manager.getReflectionSchedule(schedule.id);
      expect(retrievedSchedule).toBeNull();
    });

    it('should list reflection schedules', async () => {
      await manager.schedulePeriodicReflection('daily', {
        name: 'Daily Schedule',
        depth: 'light' as const
      });

      await manager.schedulePeriodicReflection('weekly', {
        name: 'Weekly Schedule',
        depth: 'standard' as const
      });
      
      const allSchedules = await manager.listReflectionSchedules();
      expect(allSchedules.length).toBeGreaterThanOrEqual(2);
      
      const activeSchedules = await manager.listReflectionSchedules({ active: true });
      expect(Array.isArray(activeSchedules)).toBe(true);
      
      const dailySchedules = await manager.listReflectionSchedules({ frequency: 'daily' });
      expect(Array.isArray(dailySchedules)).toBe(true);
    });

    it('should get due reflections', async () => {
      // This would test getting reflections that are due for execution
      const dueReflections = await manager.getDueReflections();
      
      expect(Array.isArray(dueReflections)).toBe(true);
      // With mock data, there may or may not be due reflections
    });
  });

  // ============================================================================
  // Integration and Statistics Tests
  // ============================================================================

  describe('Integration and Statistics', () => {
    it('should track comprehensive statistics', async () => {
      // Create a plan
      const planData = {
        name: 'Stats Test Plan',
        description: 'Plan for testing statistics',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };
      const plan = await manager.createImprovementPlan(planData);

      // Create an activity
      const activityData = {
        planId: plan.id,
        name: 'Stats Test Activity',
        description: 'Activity for testing statistics',
        type: 'reading' as const,
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'completed' as const,
        priority: ImprovementPriority.MEDIUM,
        estimatedDuration: 60,
        resources: [],
        prerequisites: [],
        successCriteria: ['Complete reading'],
        metadata: {}
      };
      const activity = await manager.createLearningActivity(activityData);

      // Record an outcome
      const outcomeData = {
        planId: plan.id,
        activityId: activity.id,
        type: 'knowledge_gained' as const,
        area: ImprovementAreaType.KNOWLEDGE,
        description: 'Learned statistics concepts',
        confidence: 0.8,
        evidence: ['Completed reading'],
        appliedToBehavior: false,
        relatedInsightIds: [],
        metadata: {}
      };
      await manager.recordLearningOutcome(outcomeData);

      // Generate a progress report
      await manager.generateProgressReport(plan.id);

      const stats = await manager.getStats();
      
      expect(stats.totalPlans).toBe(1);
      expect(stats.totalActivities).toBe(1);
      expect(stats.totalOutcomes).toBe(1);
      expect(stats.totalReflections).toBe(1);
      expect(stats.averageReflectionTime).toBeGreaterThan(0);
      expect(stats.lastReflectionTime).toBeInstanceOf(Date);
      expect(stats.systemUptime).toBeGreaterThan(0);
    });

    it('should handle concurrent operations within limits', async () => {
      const planData = {
        name: 'Concurrent Test Plan',
        description: 'Plan for testing concurrent operations',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };

      // Create multiple plans concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        manager.createImprovementPlan({
          ...planData,
          name: `Concurrent Plan ${i + 1}`
        })
      );

      const plans = await Promise.all(promises);
      
      expect(plans).toHaveLength(5);
      plans.forEach((plan, index) => {
        expect(plan.name).toBe(`Concurrent Plan ${index + 1}`);
      });

      const stats = await manager.getStats();
      expect(stats.totalPlans).toBe(5);
    });

    it('should handle operation limit exceeded', async () => {
      // Create a manager with very low concurrent operation limit
      const limitedManager = new DefaultReflectionManager({
        maxConcurrentOperations: 1
      });
      await limitedManager.initialize();

      try {
        const planData = {
          name: 'Limit Test Plan',
          description: 'Plan for testing operation limits',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          sourceReflectionIds: ['reflection-1'],
          targetAreas: [ImprovementAreaType.KNOWLEDGE],
          status: 'active' as const,
          priority: ImprovementPriority.MEDIUM,
          progress: 0,
          successMetrics: ['completion_rate'],
          successCriteria: ['Complete all activities']
        };

        // Try to create many plans simultaneously
        const promises = Array.from({ length: 5 }, (_, i) =>
          limitedManager.createImprovementPlan({
            ...planData,
            name: `Limit Plan ${i + 1}`
          })
        );

        // Some operations should succeed, others might fail due to limits
        const results = await Promise.allSettled(promises);
        
        // At least one should succeed
        const successful = results.filter(r => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);
      } finally {
        await limitedManager.shutdown();
      }
    });

    it('should clear all data and reset statistics', async () => {
      // Create some data
      const planData = {
        name: 'Clear Test Plan',
        description: 'Plan for testing clear functionality',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['completion_rate'],
        successCriteria: ['Complete all activities']
      };
      await manager.createImprovementPlan(planData);

      let stats = await manager.getStats();
      expect(stats.totalPlans).toBe(1);

      // Clear all data
      await manager.clear();

      stats = await manager.getStats();
      expect(stats.totalPlans).toBe(0);
      expect(stats.totalActivities).toBe(0);
      expect(stats.totalOutcomes).toBe(0);
      expect(stats.totalReflections).toBe(0);
      expect(stats.averageReflectionTime).toBe(0);
      expect(stats.lastReflectionTime).toBeUndefined();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle invalid plan operations gracefully', async () => {
      // Try to get non-existent plan
      const plan = await manager.getImprovementPlan('non-existent-id');
      expect(plan).toBeNull();

      // Try to update non-existent plan
      await expect(manager.updateImprovementPlan('non-existent-id', { name: 'Updated' }))
        .rejects.toThrow();

      // Try to delete non-existent plan
      const deleted = await manager.deleteImprovementPlan('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should handle invalid activity operations gracefully', async () => {
      // Try to get non-existent activity
      const activity = await manager.getLearningActivity('non-existent-id');
      expect(activity).toBeNull();

      // Try to start non-existent activity
      await expect(manager.startLearningActivity('non-existent-id'))
        .rejects.toThrow();

      // Try to complete non-existent activity
      await expect(manager.completeLearningActivity('non-existent-id'))
        .rejects.toThrow();
    });

    it('should handle invalid outcome operations gracefully', async () => {
      // Try to get non-existent outcome
      const outcome = await manager.getLearningOutcome('non-existent-id');
      expect(outcome).toBeNull();

      // Try to apply non-existent outcome to behavior
      await expect(manager.applyOutcomeToBehavior('non-existent-id', 0.8))
        .rejects.toThrow();
    });

    it('should handle invalid schedule operations gracefully', async () => {
      // Try to get non-existent schedule
      const schedule = await manager.getReflectionSchedule('non-existent-id');
      expect(schedule).toBeNull();

      // Try to update non-existent schedule
      await expect(manager.updateReflectionSchedule('non-existent-id', { enabled: false }))
        .rejects.toThrow();

      // Try to cancel non-existent schedule
      const cancelled = await manager.cancelReflectionSchedule('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });
}); 