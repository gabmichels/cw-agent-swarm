/**
 * Planner.ts - Task planning with memory context integration
 * 
 * This module provides planning capabilities that leverage the agent's memory
 * to create more informed and context-aware plans.
 */

import { MemoryType } from '../../../server/memory/config';
import { BaseMemorySchema, MemoryPoint } from '../../../server/memory/models';
import { getMemoryServices } from '../../../server/memory/services';
import { enforceEthics } from '../ethics/EthicsMiddleware';

export interface PlanningContext {
  // The goal of the task
  goal: string;

  // Tags associated with the task
  tags?: string[];

  // Agent who will execute the plan
  agentId: string;

  // Related delegation context
  delegationContextId?: string;

  // Injected memory context
  memoryContext?: MemoryPoint<BaseMemorySchema>[];

  // Additional task-specific context
  additionalContext?: Record<string, any>;
}

export interface PlanStep {
  // Step description
  description: string;

  // Estimated difficulty (1-5)
  difficulty?: number;

  // Estimated time to complete (in minutes)
  estimatedTimeMinutes?: number;

  // Tools required for this step
  requiredTools?: string[];

  // Step dependencies (indices of other steps)
  dependsOn?: number[];

  // Retry options
  retryCount?: number;        // default: 1
  retryDelayMs?: number;      // backoff applies
  timeoutMs?: number;         // optional timeout for this step
}

export interface Plan {
  // Plan title
  title: string;

  // Plan steps
  steps: PlanStep[];

  // Overall reasoning
  reasoning: string;

  // Estimated total execution time (in minutes)
  estimatedTotalTimeMinutes: number;

  // The original planning context
  context: PlanningContext;

  // Retry options
  retryCount?: number;         // default: 2
  retryDelayMs?: number;       // base delay (used for backoff)
  timeoutMs?: number;          // optional timeout for whole plan
}

/**
 * Planner class with memory context injection
 */
export class Planner {
  /**
   * Create a plan for a task with memory context
   */
  static async plan(context: PlanningContext): Promise<Plan> {
    console.log(`Planning task: ${context.goal} for agent ${context.agentId}`);

    // If memory context is not provided, fetch it
    if (!context.memoryContext || context.memoryContext.length === 0) {
      try {
        // Get memory services
        const { searchService } = await getMemoryServices();

        // Build filter for the agent's memories
        const filter: any = {
          must: [
            {
              key: "metadata.agentId",
              match: {
                value: context.agentId
              }
            }
          ]
        };

        // Add delegation context to filter if provided
        if (context.delegationContextId) {
          filter.must.push({
            key: "metadata.delegationContextId",
            match: {
              value: context.delegationContextId
            }
          });
        }

        // Add tags to filter if provided
        if (context.tags && context.tags.length > 0) {
          filter.must.push({
            key: "metadata.tags",
            match: {
              any: context.tags
            }
          });
        }

        // Search for relevant memories using the standardized search service
        const searchResults = await searchService.search(context.goal, {
          types: [MemoryType.THOUGHT, MemoryType.TASK],
          filter: filter,
          limit: 10
        });

        // Extract memory points from search results
        context.memoryContext = searchResults.map((result: any) => result.point);
      } catch (error) {
        console.error('Error fetching memory context:', error);
        // Continue with empty context
        context.memoryContext = [];
      }
    }

    // Format memory context for the LLM prompt
    const memoryContextForPrompt = this.formatMemoriesForPrompt(
      context.memoryContext || []
    );

    console.log('Planning with memory context:', memoryContextForPrompt);

    // In a real implementation, this would call an LLM with a prompt that includes:
    // 1. The planning objective (context.goal)
    // 2. The formatted memory context
    // 3. Additional context and constraints

    // Mock plan - would be replaced with LLM output
    const mockPlan: Plan = {
      title: `Plan for: ${context.goal}`,
      steps: [
        {
          description: "Analyze requirements and constraints",
          difficulty: 2,
          estimatedTimeMinutes: 15,
          requiredTools: ["analysis"]
        },
        {
          description: "Develop solution approach based on past insights",
          difficulty: 3,
          estimatedTimeMinutes: 30,
          requiredTools: ["planning"],
          dependsOn: [0]
        },
        {
          description: "Execute core implementation",
          difficulty: 4,
          estimatedTimeMinutes: 45,
          requiredTools: ["coding", "testing"],
          dependsOn: [1]
        },
        {
          description: "Validate and finalize",
          difficulty: 2,
          estimatedTimeMinutes: 20,
          requiredTools: ["validation"],
          dependsOn: [2]
        }
      ],
      reasoning: `This plan addresses the goal: "${context.goal}" by breaking it down into logical steps. Memory context has been considered in developing an approach that builds on past experience.`,
      estimatedTotalTimeMinutes: 110,
      context
    };

    // Generate a text representation of the plan for ethics check
    const planText = this.planToString(mockPlan);

    // Run ethics checks on the generated plan
    const taskId = `planning_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const { output: checkedPlanText, violations } = await enforceEthics({
      agentId: context.agentId,
      taskId,
      output: planText
    });

    // If there were violations, log them and potentially modify the plan
    if (violations && violations.length > 0) {
      console.log(`Ethics violations detected in plan for ${context.goal}`);
      // In a real implementation, you might modify the plan based on violations
      // For this demo, we'll just continue with the original plan
    }

    return mockPlan;
  }

  /**
   * Format memories for inclusion in prompts
   */
  static formatMemoriesForPrompt(memories: MemoryPoint<BaseMemorySchema>[]): string {
    if (!memories || memories.length === 0) {
      return "No relevant memories available.";
    }

    // Group memories by type
    const byType: Record<string, MemoryPoint<BaseMemorySchema>[]> = {};

    for (const memory of memories) {
      const type = memory.payload.type || 'unknown';
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(memory);
    }

    // Format each type section
    const sections: string[] = [];

    // Order of types in the output
    const typeOrder: string[] = [MemoryType.THOUGHT, MemoryType.TASK, MemoryType.DOCUMENT, MemoryType.MESSAGE];

    for (const type of typeOrder) {
      const entriesOfType = byType[type];
      if (entriesOfType && entriesOfType.length > 0) {
        sections.push(`RELEVANT ${type.toUpperCase()} MEMORIES:`);

        for (const entry of entriesOfType) {
          sections.push(`- ${entry.payload.text}`);
        }

        sections.push('');
      }
    }

    return sections.join('\n');
  }

  /**
   * Convert a plan to string format for ethics checking
   */
  private static planToString(plan: Plan): string {
    let planText = `PLAN: ${plan.title}\n\n`;
    planText += `REASONING: ${plan.reasoning}\n\n`;
    planText += `STEPS:\n`;

    plan.steps.forEach((step, index) => {
      planText += `${index + 1}. ${step.description}\n`;
      if (step.requiredTools) {
        planText += `   Tools: ${step.requiredTools.join(', ')}\n`;
      }
      if (step.dependsOn) {
        planText += `   Depends on steps: ${step.dependsOn.map(i => i + 1).join(', ')}\n`;
      }
    });

    return planText;
  }

  /**
   * Execute a single step of a plan
   * (Would be expanded in a real implementation)
   */
  static async executeStep(
    plan: Plan,
    stepIndex: number
  ): Promise<{ success: boolean; result: any }> {
    if (stepIndex < 0 || stepIndex >= plan.steps.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    const step = plan.steps[stepIndex];
    console.log(`Executing step ${stepIndex + 1}: ${step.description}`);

    // Mock execution - would be replaced with real execution
    return {
      success: true,
      result: `Completed: ${step.description}`
    };
  }

  /**
   * Execute all steps in a plan in sequence
   * (Would be expanded in a real implementation)
   */
  static async executePlan(plan: Plan): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];
    let success = true;

    for (let i = 0; i < plan.steps.length; i++) {
      try {
        const stepResult = await this.executeStep(plan, i);
        results.push(stepResult.result);
        if (!stepResult.success) {
          success = false;
          break;
        }
      } catch (error) {
        console.error(`Error executing step ${i + 1}:`, error);
        success = false;
        break;
      }
    }

    return { success, results };
  }
}