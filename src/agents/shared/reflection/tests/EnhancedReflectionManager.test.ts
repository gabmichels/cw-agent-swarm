/**
 * Enhanced Reflection Manager Tests
 * 
 * This file contains tests for the EnhancedReflectionManager
 * including periodic reflection and self-improvement capabilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedReflectionManager } from '../managers/EnhancedReflectionManager';
import { AgentBase } from '../../base/AgentBase.interface';
import { ImprovementAreaType, ImprovementPriority, LearningOutcomeType } from '../../../../lib/agents/base/managers/ReflectionManager';

// Mock agent for testing
const mockAgent = {
  getAgentId: () => 'test-agent-id',
  hasManager: () => true,
  getManager: () => null
} as unknown as AgentBase;

// Mock console for cleaner test output
const originalConsole = { ...console };
beforeEach(() => {
  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();
  console.debug = vi.fn();
});

afterEach(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.debug = originalConsole.debug;
});

describe('EnhancedReflectionManager', () => {
  describe('Initialization and Configuration', () => {
    it('should initialize with default configuration', async () => {
      const manager = new EnhancedReflectionManager(mockAgent);
      await manager.initialize();
      expect(manager).toBeDefined();
      expect(manager['managerId']).toContain('reflection-manager');
      
      const health = await manager.getHealth();
      expect(health.status).toBe('healthy');
    });
    
    it('should accept custom configuration', () => {
      const manager = new EnhancedReflectionManager(mockAgent, {
        enabled: true,
        reflectionDepth: 'deep',
        enablePeriodicReflections: true,
        periodicReflectionSchedule: '0 */6 * * *', // Every 6 hours
        enableSelfImprovement: true,
        defaultImprovementAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL]
      });
      
      expect(manager).toBeDefined();
      expect(manager.getType()).toBe('reflection');
    });
  });
  
  describe('Self-Improvement Capabilities', () => {
    let manager: EnhancedReflectionManager;
    
    beforeEach(async () => {
      manager = new EnhancedReflectionManager(mockAgent, {
        enableSelfImprovement: true
      });
      await manager.initialize();
    });
    
    afterEach(async () => {
      await manager.shutdown();
    });
    
    it('should create and retrieve improvement plans', async () => {
      // Create a plan
      const plan = await manager.createImprovementPlan({
        name: 'Test Improvement Plan',
        targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
        priority: ImprovementPriority.HIGH,
        improvements: [
          {
            area: ImprovementAreaType.KNOWLEDGE,
            description: 'Improve knowledge in TypeScript',
            priority: ImprovementPriority.HIGH,
            expectedOutcome: 'Better code quality'
          }
        ],
        successMetrics: ['code_quality', 'development_speed'],
        status: 'draft',
        timelineInDays: 30,
        source: 'manual',
        progress: 0
      });
      
      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.name).toBe('Test Improvement Plan');
      
      // Retrieve the plan
      const retrievedPlan = await manager.getImprovementPlan(plan.id);
      expect(retrievedPlan).toEqual(plan);
      
      // Update the plan
      const updatedPlan = await manager.updateImprovementPlan(plan.id, {
        progress: 25,
        status: 'active'
      });
      
      expect(updatedPlan.progress).toBe(25);
      expect(updatedPlan.status).toBe('active');
      
      // List plans
      const plans = await manager.listImprovementPlans({
        status: ['active'],
        priority: [ImprovementPriority.HIGH]
      });
      
      expect(plans.length).toBe(1);
      expect(plans[0].id).toBe(plan.id);
    });
    
    it('should manage learning activities', async () => {
      // Create a plan first
      const plan = await manager.createImprovementPlan({
        name: 'Test Plan',
        targetAreas: [ImprovementAreaType.SKILL],
        priority: ImprovementPriority.MEDIUM,
        improvements: [],
        successMetrics: [],
        status: 'active',
        timelineInDays: 14,
        source: 'manual',
        progress: 0
      });
      
      // Create an activity
      const activity = await manager.createLearningActivity({
        planId: plan.id,
        name: 'Learn TypeScript',
        description: 'Study TypeScript fundamentals',
        type: 'study',
        area: ImprovementAreaType.SKILL,
        status: 'pending',
        expectedOutcome: 'Better TypeScript skills'
      });
      
      expect(activity).toBeDefined();
      expect(activity.id).toBeDefined();
      expect(activity.planId).toBe(plan.id);
      
      // Update the activity
      const updatedActivity = await manager.updateLearningActivity(activity.id, {
        status: 'in_progress',
        startTime: new Date()
      });
      
      expect(updatedActivity.status).toBe('in_progress');
      expect(updatedActivity.startTime).toBeDefined();
      
      // List activities
      const activities = await manager.listLearningActivities({
        planId: plan.id,
        status: ['in_progress']
      });
      
      expect(activities.length).toBe(1);
      expect(activities[0].id).toBe(activity.id);
      
      // Complete the activity
      const completedActivity = await manager.updateLearningActivity(activity.id, {
        status: 'completed',
        completionTime: new Date(),
        actualOutcome: 'Learned TypeScript basics',
        successRating: 85,
        lessonsLearned: ['TypeScript interfaces are powerful']
      });
      
      expect(completedActivity.status).toBe('completed');
      expect(completedActivity.successRating).toBe(85);
      
      // Check that plan progress was updated
      const updatedPlan = await manager.getImprovementPlan(plan.id);
      expect(updatedPlan?.progress).toBeGreaterThan(0);
    });
    
    it('should manage learning outcomes and generate reports', async () => {
      // Create a plan
      const plan = await manager.createImprovementPlan({
        name: 'Test Plan',
        targetAreas: [ImprovementAreaType.PROCESS],
        priority: ImprovementPriority.MEDIUM,
        improvements: [],
        successMetrics: ['efficiency'],
        status: 'active',
        timelineInDays: 30,
        source: 'manual',
        progress: 0
      });
      
      // Create an activity
      const activity = await manager.createLearningActivity({
        planId: plan.id,
        name: 'Improve Code Review Process',
        description: 'Study best practices for code reviews',
        type: 'study',
        area: ImprovementAreaType.PROCESS,
        status: 'completed',
        expectedOutcome: 'Better code review process',
        completionTime: new Date(),
        successRating: 90
      });
      
      // Record a learning outcome
      const outcome = await manager.recordLearningOutcome({
        planId: plan.id,
        activityIds: [activity.id],
        type: LearningOutcomeType.IMPROVED_PROCESS,
        description: 'Learned how to conduct more efficient code reviews',
        confidence: 0.85,
        affectedAreas: [ImprovementAreaType.PROCESS],
        appliedToBehavior: false
      });
      
      expect(outcome).toBeDefined();
      expect(outcome.id).toBeDefined();
      expect(outcome.planId).toBe(plan.id);
      
      // Apply the outcome
      const applied = await manager.applyLearningOutcomes([outcome.id]);
      expect(applied).toBe(true);
      
      // Verify the outcome was updated
      const updatedOutcome = await manager.getLearningOutcome(outcome.id);
      expect(updatedOutcome?.appliedToBehavior).toBe(true);
      
      // Generate a progress report
      const report = await manager.generateProgressReport(plan.id, {
        includeActivities: true,
        includeOutcomes: true,
        includeMetrics: true,
        includeRecommendations: true
      });
      
      expect(report).toBeDefined();
      expect(report.planId).toBe(plan.id);
      expect(report.completedActivities.length).toBe(1);
      expect(report.outcomes.length).toBe(1);
    });
  });
  
  describe('Periodic Reflection Capabilities', () => {
    let manager: EnhancedReflectionManager;
    
    beforeEach(async () => {
      manager = new EnhancedReflectionManager(mockAgent, {
        enablePeriodicReflections: true,
        periodicReflectionSchedule: '0 0 * * *' // Daily at midnight
      });
      await manager.initialize();
    });
    
    afterEach(async () => {
      await manager.shutdown();
    });
    
    it('should schedule and manage periodic reflections', async () => {
      // Schedule a custom reflection
      const task = await manager.schedulePeriodicReflection(
        '0 */4 * * *', // Every 4 hours
        {
          name: 'Regular Knowledge Review',
          depth: 'standard',
          focusAreas: ['knowledge', 'skill']
        }
      );
      
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.name).toBe('Regular Knowledge Review');
      expect(task.enabled).toBe(true);
      
      // Retrieve the task
      const retrievedTask = await manager.getPeriodicReflectionTask(task.id);
      expect(retrievedTask).toEqual(task);
      
      // Update the task
      const updatedTask = await manager.updatePeriodicReflectionTask(task.id, {
        parameters: {
          ...task.parameters,
          depth: 'deep'
        }
      });
      
      expect(updatedTask.parameters.depth).toBe('deep');
      
      // List tasks
      const tasks = await manager.listPeriodicReflectionTasks({
        enabled: true
      });
      
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      
      // Run a task manually
      const result = await manager.runPeriodicReflectionTask(task.id, {
        updateNextRunTime: true,
        context: { manualTrigger: true }
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      
      // Disable a task
      const disabledTask = await manager.setPeriodicReflectionTaskEnabled(task.id, false);
      expect(disabledTask.enabled).toBe(false);
      
      // Delete a task
      const deleted = await manager.deletePeriodicReflectionTask(task.id);
      expect(deleted).toBe(true);
      
      // Verify task is gone
      const deletedTask = await manager.getPeriodicReflectionTask(task.id);
      expect(deletedTask).toBeNull();
    });
    
    it('should integrate periodic reflections with reflections system', async () => {
      // Create a reflection task
      const task = await manager.schedulePeriodicReflection(
        '0 12 * * *', // Daily at noon
        {
          name: 'Daily Learning Reflection',
          depth: 'standard'
        }
      );
      
      // Mock the reflect method to test integration
      const originalReflect = manager.reflect;
      manager.reflect = vi.fn().mockImplementation(async (trigger, context) => {
        expect(trigger).toBe('periodic');
        expect(context).toBeDefined();
        return {
          success: true,
          id: 'mock-reflection-id',
          insights: [],
          message: 'Mock reflection completed'
        };
      });
      
      // Run the task
      await manager.runPeriodicReflectionTask(task.id);
      
      // Verify reflect was called
      expect(manager.reflect).toHaveBeenCalledWith('periodic', expect.any(Object));
      
      // Restore original method
      manager.reflect = originalReflect;
    });
    
    it('should generate improvement plans from reflections', async () => {
      // Create a mock reflection
      const reflection = await manager.createReflection({
        trigger: 'manual',
        context: {},
        depth: 'deep',
        insights: [],
        metrics: {}
      });
      
      // Create some insights for the reflection
      const insight1 = {
        id: 'insight-1',
        reflectionId: reflection.id,
        timestamp: new Date(),
        type: 'learning',
        content: 'Need to improve TypeScript skills',
        confidence: 0.9,
        metadata: {}
      };
      
      const insight2 = {
        id: 'insight-2',
        reflectionId: reflection.id,
        timestamp: new Date(),
        type: 'improvement',
        content: 'Should optimize build process',
        confidence: 0.8,
        metadata: {}
      };
      
      // Mock getInsight to return our test insights
      const originalGetInsight = manager.getInsight;
      manager.getInsight = vi.fn().mockImplementation(async (id) => {
        if (id === 'insight-1') return insight1;
        if (id === 'insight-2') return insight2;
        return null;
      });
      
      // Update reflection with insights
      await manager.updateConfig({
        enableSelfImprovement: true
      });
      
      // Generate a plan from the reflection
      const plan = await manager.generateImprovementPlanFromReflections(
        [reflection.id],
        {
          focusAreas: [ImprovementAreaType.SKILL, ImprovementAreaType.PROCESS],
          priorityThreshold: ImprovementPriority.HIGH
        }
      );
      
      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.targetAreas).toContain(ImprovementAreaType.SKILL);
      expect(plan.targetAreas).toContain(ImprovementAreaType.PROCESS);
      expect(plan.improvements.length).toBeGreaterThan(0);
      expect(plan.status).toBe('draft');
      
      // Restore original method
      manager.getInsight = originalGetInsight;
    });
  });
}); 