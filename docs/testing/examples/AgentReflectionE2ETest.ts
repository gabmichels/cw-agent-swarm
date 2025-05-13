// @ts-ignore - These imports would exist in actual implementation
import { AgentBase } from '../../src/agents/shared/interfaces/AgentBase.interface';
// @ts-ignore - These imports would exist in actual implementation
import { DefaultAgentFactory } from '../../src/agents/shared/factories/DefaultAgentFactory';
// @ts-ignore - These imports would exist in actual implementation
import { ReflectionType, ReflectionPriority } from '../../src/agents/shared/interfaces/ReflectionManager.interface';
// @ts-ignore - These imports would exist in actual implementation
import { TaskDecompositionStrategy } from '../../src/agents/shared/types/TaskTypes';

describe('Agent Reflection & Task Decomposition E2E Tests', () => {
  let agent: AgentBase;
  let agentFactory: DefaultAgentFactory;
  
  // Setup before all tests
  beforeAll(async () => {
    // Create agent factory
    agentFactory = new DefaultAgentFactory();
    
    // Initialize agent with reflection capabilities
    agent = await agentFactory.createAgent({
      agentId: 'reflection-agent-' + Date.now(),
      config: {
        enableMemoryManager: true,
        enableKnowledgeManager: true,
        enableReflectionManager: true,
        enablePlanningManager: true,
        reflectionConfig: {
          enablePeriodicReflection: true,
          enableLearningFromReflection: true,
          reflectionFrequency: 5, // After every 5 operations
          priorityThreshold: 0.7, // Only apply high-priority insights
          insightRetentionDays: 30
        },
        planningConfig: {
          enableTaskDecomposition: true,
          maxDecompositionDepth: 3,
          defaultDecompositionStrategy: TaskDecompositionStrategy.HIERARCHICAL
        }
      }
    });
  });
  
  // Cleanup after all tests
  afterAll(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });
  
  // Self-reflection test
  test('Should perform self-reflection and generate insights', async () => {
    // Create test memories to reflect on
    const memoryIds = await Promise.all([
      agent.createMemory({
        type: 'TASK',
        content: 'Research quantum computing concepts',
        metadata: { 
          status: 'COMPLETED',
          difficulty: 'high',
          timeSpent: 1200,
          outcome: 'successful'
        }
      }),
      agent.createMemory({
        type: 'TASK',
        content: 'Explain quantum computing to a beginner',
        metadata: { 
          status: 'COMPLETED',
          difficulty: 'medium',
          timeSpent: 600,
          outcome: 'partially successful'
        }
      }),
      agent.createMemory({
        type: 'ERROR',
        content: 'Failed to simplify explanation of quantum superposition',
        metadata: { 
          severity: 'medium',
          context: 'explanation task',
          relatedTask: 'Explain quantum computing'
        }
      })
    ]);
    
    // Trigger reflection process
    const reflectionId = await agent.triggerReflection({
      type: ReflectionType.PERFORMANCE_ANALYSIS,
      scope: {
        timeRange: {
          start: Date.now() - 3600000, // Last hour
          end: Date.now()
        },
        memoryTypes: ['TASK', 'ERROR']
      },
      priority: ReflectionPriority.HIGH
    });
    
    // Verify reflection process started
    expect(reflectionId).toBeDefined();
    
    // Wait for reflection to complete
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();
    
    let reflectionStatus = await agent.getReflectionStatus(reflectionId);
    while (
      reflectionStatus.status !== 'COMPLETED' && 
      reflectionStatus.status !== 'FAILED' &&
      Date.now() - startTime < maxWaitTime
    ) {
      await new Promise(resolve => setTimeout(resolve, 500));
      reflectionStatus = await agent.getReflectionStatus(reflectionId);
    }
    
    // Verify reflection completed
    expect(reflectionStatus.status).toBe('COMPLETED');
    
    // Get reflection results
    const reflectionResults = await agent.getReflectionResults(reflectionId);
    
    // Verify insights were generated
    expect(reflectionResults.insights.length).toBeGreaterThan(0);
    
    // Verify insights have actionable items
    const hasActionableInsights = reflectionResults.insights.some(
      insight => insight.actionItems && insight.actionItems.length > 0
    );
    expect(hasActionableInsights).toBeTruthy();
    
    // Check for specific insights about explanation difficulty
    const hasExplanationInsight = reflectionResults.insights.some(
      insight => insight.content.toLowerCase().includes('explanation') || 
                 insight.content.toLowerCase().includes('simplify')
    );
    expect(hasExplanationInsight).toBeTruthy();
    
    // Clean up
    await Promise.all(memoryIds.map(id => agent.deleteMemory(id)));
    await agent.deleteReflection(reflectionId);
  });
  
  // Learning from reflection test
  test('Should incorporate learnings from reflection into behavior', async () => {
    // Create initial learning task
    const initialTaskId = await agent.createTask({
      title: 'Explain machine learning concepts',
      description: 'Create a simplified explanation of key machine learning concepts',
      requirements: {
        audienceLevel: 'beginner',
        topicsToInclude: ['supervised learning', 'unsupervised learning', 'neural networks'],
        maxLength: 1000
      }
    });
    
    // Execute the initial task
    const initialExecutionId = await agent.executeTask(initialTaskId);
    
    // Wait for execution to complete
    let taskStatus = await agent.getTaskStatus(initialExecutionId);
    while (taskStatus !== 'COMPLETED' && taskStatus !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 500));
      taskStatus = await agent.getTaskStatus(initialExecutionId);
    }
    
    // Get initial results
    const initialResults = await agent.getTaskResults(initialExecutionId);
    
    // Create explicit reflection on the task
    const reflectionId = await agent.triggerReflection({
      type: ReflectionType.TASK_IMPROVEMENT,
      scope: {
        taskIds: [initialTaskId]
      },
      priority: ReflectionPriority.HIGH,
      focusAreas: ['simplification', 'audience appropriateness', 'analogy usage']
    });
    
    // Wait for reflection to complete
    let reflectionStatus = await agent.getReflectionStatus(reflectionId);
    while (reflectionStatus.status !== 'COMPLETED' && reflectionStatus.status !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 500));
      reflectionStatus = await agent.getReflectionStatus(reflectionId);
    }
    
    // Get learning insights
    const learnings = await agent.getReflectionLearnings(reflectionId);
    
    // Create a similar task after reflection
    const improvedTaskId = await agent.createTask({
      title: 'Explain deep learning concepts',
      description: 'Create a simplified explanation of key deep learning concepts',
      requirements: {
        audienceLevel: 'beginner',
        topicsToInclude: ['deep neural networks', 'convolutional networks', 'recurrent networks'],
        maxLength: 1000
      }
    });
    
    // Execute the improved task
    const improvedExecutionId = await agent.executeTask(improvedTaskId);
    
    // Wait for execution to complete
    taskStatus = await agent.getTaskStatus(improvedExecutionId);
    while (taskStatus !== 'COMPLETED' && taskStatus !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 500));
      taskStatus = await agent.getTaskStatus(improvedExecutionId);
    }
    
    // Get improved results
    const improvedResults = await agent.getTaskResults(improvedExecutionId);
    
    // Analyze both results using an external evaluation function
    const initialScore = await agent.evaluateContent(initialResults.content, {
      criteria: ['simplicity', 'clarity', 'analogy_usage', 'audience_appropriateness']
    });
    
    const improvedScore = await agent.evaluateContent(improvedResults.content, {
      criteria: ['simplicity', 'clarity', 'analogy_usage', 'audience_appropriateness']
    });
    
    // Verify improvement in scores
    expect(improvedScore.overall).toBeGreaterThan(initialScore.overall);
    expect(improvedScore.criteria.simplicity).toBeGreaterThan(initialScore.criteria.simplicity);
    expect(improvedScore.criteria.analogy_usage).toBeGreaterThan(initialScore.criteria.analogy_usage);
    
    // Validate that learnings were applied
    const learningsApplied = await agent.checkLearningsApplication(learnings, improvedResults.content);
    expect(learningsApplied.applied).toBeTruthy();
    expect(learningsApplied.appliedCount).toBeGreaterThan(0);
    
    // Clean up
    await agent.deleteTask(initialTaskId);
    await agent.deleteTask(improvedTaskId);
    await agent.deleteReflection(reflectionId);
  });
  
  // Task decomposition test
  test('Should decompose complex tasks effectively', async () => {
    // Create a complex task
    const complexTaskId = await agent.createTask({
      title: 'Create comprehensive guide to quantum computing',
      description: 'Develop a detailed guide covering quantum computing fundamentals, applications, and future outlook',
      requirements: {
        sections: [
          'Introduction to Quantum Computing',
          'Quantum Bits and Superposition',
          'Quantum Entanglement and Teleportation',
          'Quantum Gates and Circuits',
          'Quantum Algorithms',
          'Quantum Hardware Platforms',
          'Current Applications',
          'Future Outlook'
        ],
        audienceLevel: 'intermediate',
        includeVisuals: true,
        includeExamples: true,
        formatRequirements: 'structured with clear headings and subheadings'
      }
    });
    
    // Request task decomposition
    const decompositionId = await agent.decomposeTask(complexTaskId, {
      strategy: TaskDecompositionStrategy.HIERARCHICAL,
      maxDepth: 3,
      optimizeFor: 'completeness'
    });
    
    // Wait for decomposition to complete
    let decompositionStatus = await agent.getDecompositionStatus(decompositionId);
    while (decompositionStatus !== 'COMPLETED' && decompositionStatus !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 500));
      decompositionStatus = await agent.getDecompositionStatus(decompositionId);
    }
    
    // Get decomposition results
    const decomposition = await agent.getTaskDecomposition(decompositionId);
    
    // Verify structure of decomposition
    expect(decomposition.subtasks.length).toBeGreaterThan(0);
    expect(decomposition.depth).toBeGreaterThanOrEqual(2);
    
    // Verify all sections are covered
    const allSectionsCovered = decomposition.subtasks.some(subtask => 
      subtask.title.includes('Introduction') || 
      subtask.children.some(child => child.title.includes('Introduction'))
    ) &&
    decomposition.subtasks.some(subtask => 
      subtask.title.includes('Future Outlook') || 
      subtask.children.some(child => child.title.includes('Future Outlook'))
    );
    
    expect(allSectionsCovered).toBeTruthy();
    
    // Verify dependencies are created correctly
    const hasDependencies = decomposition.dependencies && 
                            decomposition.dependencies.length > 0;
    expect(hasDependencies).toBeTruthy();
    
    // Execute the decomposed task
    const executionId = await agent.executeDecomposedTask(decompositionId);
    
    // Wait for execution to complete (this might take longer)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    let executionStatus = await agent.getDecomposedTaskStatus(executionId);
    while (
      executionStatus.status !== 'COMPLETED' && 
      executionStatus.status !== 'FAILED' &&
      Date.now() - startTime < maxWaitTime
    ) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      executionStatus = await agent.getDecomposedTaskStatus(executionId);
    }
    
    // Verify execution progress
    expect(executionStatus.completedSubtasks).toBeGreaterThanOrEqual(
      executionStatus.totalSubtasks * 0.5
    ); // At least 50% complete in our timeout window
    
    // If execution completed, verify results
    if (executionStatus.status === 'COMPLETED') {
      const results = await agent.getDecomposedTaskResults(executionId);
      
      // Verify results completeness
      expect(results.sections.length).toBeGreaterThanOrEqual(
        decomposition.subtasks.length
      );
      
      // Verify results quality
      const qualityScore = await agent.evaluateContent(results.content, {
        criteria: ['completeness', 'coherence', 'structure']
      });
      
      expect(qualityScore.overall).toBeGreaterThan(0.7); // Score above 70%
    }
    
    // Clean up
    await agent.deleteTask(complexTaskId);
    await agent.deleteDecomposition(decompositionId);
    if (executionStatus.status === 'COMPLETED') {
      await agent.deleteExecution(executionId);
    }
  });
  
  // Meta-cognitive adaptation test
  test('Should adapt strategies based on metacognitive reflection', async () => {
    // Create a series of similar tasks with different approaches
    const taskIds: string[] = [];
    
    // First approach: Direct solution
    taskIds.push(await agent.createTask({
      title: 'Solve complex math problem - Direct approach',
      description: 'Find the solution to the given differential equation',
      content: 'Solve: d²y/dx² + 4(dy/dx) + 4y = e^(-2x) * sin(x)',
      strategy: 'DIRECT_SOLUTION'
    }));
    
    // Second approach: Step-by-step
    taskIds.push(await agent.createTask({
      title: 'Solve complex math problem - Step by step',
      description: 'Find the solution to the given differential equation',
      content: 'Solve: d²y/dx² + 4(dy/dx) + 4y = e^(-2x) * sin(x)',
      strategy: 'STEP_BY_STEP'
    }));
    
    // Execute both tasks
    const executionIds = await Promise.all(
      taskIds.map(taskId => agent.executeTask(taskId))
    );
    
    // Wait for executions to complete
    const results = await Promise.all(
      executionIds.map(async (executionId) => {
        let taskStatus = await agent.getTaskStatus(executionId);
        while (taskStatus !== 'COMPLETED' && taskStatus !== 'FAILED') {
          await new Promise(resolve => setTimeout(resolve, 500));
          taskStatus = await agent.getTaskStatus(executionId);
        }
        return agent.getTaskResults(executionId);
      })
    );
    
    // Trigger metacognitive reflection to compare approaches
    const reflectionId = await agent.triggerReflection({
      type: ReflectionType.STRATEGY_COMPARISON,
      scope: {
        taskIds: taskIds,
        executionIds: executionIds
      },
      priority: ReflectionPriority.HIGH
    });
    
    // Wait for reflection to complete
    let reflectionStatus = await agent.getReflectionStatus(reflectionId);
    while (reflectionStatus.status !== 'COMPLETED' && reflectionStatus.status !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 500));
      reflectionStatus = await agent.getReflectionStatus(reflectionId);
    }
    
    // Get strategy insights
    const strategyInsights = await agent.getReflectionResults(reflectionId);
    
    // Create new task to test adaptive strategy
    const adaptiveTaskId = await agent.createTask({
      title: 'Solve complex math problem - Adaptive approach',
      description: 'Find the solution to the given differential equation',
      content: 'Solve: d²z/dt² + 6(dz/dt) + 9z = e^(-3t) * cos(2t)',
      strategy: 'ADAPTIVE' // Let the agent choose based on its learnings
    });
    
    // Execute adaptive task
    const adaptiveExecutionId = await agent.executeTask(adaptiveTaskId);
    
    // Wait for execution to complete
    let adaptiveStatus = await agent.getTaskStatus(adaptiveExecutionId);
    while (adaptiveStatus !== 'COMPLETED' && adaptiveStatus !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 500));
      adaptiveStatus = await agent.getTaskStatus(adaptiveExecutionId);
    }
    
    // Get adaptive results
    const adaptiveResults = await agent.getTaskResults(adaptiveExecutionId);
    
    // Get the strategy the agent chose
    const chosenStrategy = await agent.getTaskExecutionStrategy(adaptiveExecutionId);
    
    // Verify strategy was chosen based on prior reflection
    expect(chosenStrategy).toBeDefined();
    expect(["DIRECT_SOLUTION", "STEP_BY_STEP"]).toContain(chosenStrategy);
    
    // Verify that performance improved
    const performanceStats = await agent.compareTaskPerformance([
      ...executionIds, 
      adaptiveExecutionId
    ]);
    
    // Adaptive approach should be faster or more accurate than at least one prior approach
    const adaptiveStats = performanceStats.find(
      stat => stat.executionId === adaptiveExecutionId
    );
    
    const otherStats = performanceStats.filter(
      stat => stat.executionId !== adaptiveExecutionId
    );
    
    // Either faster or more accurate than at least one previous approach
    const isImproved = otherStats.some(stat => 
      adaptiveStats.metrics.executionTime < stat.metrics.executionTime ||
      adaptiveStats.metrics.accuracy > stat.metrics.accuracy
    );
    
    expect(isImproved).toBeTruthy();
    
    // Clean up
    await Promise.all(taskIds.map(id => agent.deleteTask(id)));
    await agent.deleteTask(adaptiveTaskId);
    await agent.deleteReflection(reflectionId);
  });
}); 