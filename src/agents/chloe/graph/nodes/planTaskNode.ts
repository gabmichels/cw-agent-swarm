/**
 * Node for planning the task by decomposing it into sub-goals
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, PlanningTask, SubGoal, ExecutionTraceEntry } from "./types";
import { HumanCollaboration, PlannedTask } from "../../human-collaboration";
import { KnowledgeGraphManager, KnowledgeNode } from "../../knowledge/graphManager";
import { StrategicToolPlanner, PriorityAssessment, formatPriorityLevel } from "../../strategy/strategicPlanner";

// Extend the PlannedTask interface to include new properties
declare module "../../human-collaboration" {
  interface PlannedTask {
    metadata?: Record<string, any>;
    requiresDetailedPlanning?: boolean;
  }
}

/**
 * Helper function to create a timestamped execution trace entry
 */
function createTraceEntry(
  step: string, 
  status: 'success' | 'error' | 'info' | 'simulated' = 'success',
  details?: any
): ExecutionTraceEntry {
  const startTime = new Date();
  return {
    step,
    startTime,
    endTime: startTime, // For immediate actions, start and end are the same
    duration: 0,
    status,
    details
  };
}

/**
 * Plans a task by decomposing it into sub-goals
 * 
 * @param state - The current planning state
 * @param context - The node execution context
 * @returns Updated planning state
 */
export async function planTaskNode(
  state: PlanningState,
  context: NodeContext
): Promise<PlanningState> {
  const { model, memory, taskLogger } = context;
  const startTime = new Date();
  // Initialize knowledge graph manager
  const graph = new KnowledgeGraphManager();
  // Initialize strategic planner
  const strategicPlanner = new StrategicToolPlanner({ model });

  try {
    taskLogger.logAction("Planning task", { goal: state.goal });
    
    // Retrieve relevant memories to provide context
    const relevantMemories = await memory.getRelevantMemories(state.goal, 5);
    const memoryContext = relevantMemories.length > 0 
      ? "Relevant context from your memory:\n" + relevantMemories.map(m => `- ${m.content}`).join("\n")
      : "No relevant memories found.";
    
    // Query the knowledge graph for related concepts
    // First find if there's a node that closely matches our goal
    let relatedNodes: KnowledgeNode[] = [];
    let graphContext = "";
    
    // Create a task node ID for potential use (normalize the goal for use as ID)
    const taskNodeId = `task-${state.goal.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30)}`;
    
    // Find any existing nodes related to the goal topic
    // For simplicity, we'll search across all node types
    const existingNodes = await graph.queryRelatedNodes(taskNodeId);
    if (existingNodes.length > 0) {
      relatedNodes = existingNodes;
      graphContext = "Related knowledge from previous tasks:\n" + 
        relatedNodes.map(node => `- ${node.label} (${node.type}): ${node.description || ""}`).join("\n");
      
      taskLogger.logAction("Found related knowledge graph nodes", { count: relatedNodes.length });
    }
    
    // Assess the strategic priority of this task
    const taskPriority = await strategicPlanner.assessTaskPriority({
      goal: state.goal,
      // Use empty string as fallback instead of nonexistent property
      description: ""
    });
    
    // Log the priority assessment
    taskLogger.logAction("Assessed task strategic priority", { 
      priorityScore: taskPriority.priorityScore,
      priorityTags: taskPriority.priorityTags
    });
    
    // Build the strategic context based on priority
    const priorityLevel = formatPriorityLevel(taskPriority.priorityScore);
    const strategicContext = `
Strategic Assessment: This task has been assessed as ${priorityLevel} (${taskPriority.priorityScore}/100)
Strategic Tags: ${taskPriority.priorityTags.join(', ')}
Strategic Reasoning: ${taskPriority.reasoning}
    `.trim();
    
    // Create planning prompt - enhanced to support hierarchical planning and include knowledge graph context
    const planningPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant. You need to decompose a complex goal into manageable sub-goals.

GOAL: {goal}

${memoryContext}

${graphContext}

${strategicContext}

Break down this goal into 3-5 logical sub-goals that should be completed sequentially. For each sub-goal:
1. Provide a clear description
2. Assign a priority (1-5, where 1 is highest)
3. Include brief reasoning for why this sub-goal is necessary
4. If appropriate, break down complex sub-goals into 2-3 smaller children tasks

Think step by step. Consider dependencies between sub-goals and ensure they flow logically.
${relatedNodes.length > 0 ? "Use the related knowledge from previous tasks to inform your planning." : ""}
${taskPriority.priorityScore >= 70 ? "This is a HIGH STRATEGIC PRIORITY task. Ensure your plan is comprehensive and considers all critical aspects." : ""}
${taskPriority.priorityScore <= 30 ? "This is a LOWER PRIORITY task. Focus on efficiency and essential steps only." : ""}
Your response should be structured as valid JSON matching this schema:
{
  "reasoning": "Your step-by-step reasoning process for creating this plan",
  "confidenceScore": number, // Between 0.0 and 1.0 indicating your confidence in this plan
  "subGoals": [
    {
      "id": "unique_id",
      "description": "Detailed description of what needs to be done",
      "priority": number,
      "reasoning": "Why this sub-goal is important",
      "children": [
        {
          "id": "child_id",
          "description": "Description of child task",
          "priority": number,
          "reasoning": "Why this child task is important"
        }
      ]
    }
  ]
}

Only include the "children" array for sub-goals that should be broken down further.
`);
    
    // Generate plan using LLM
    const planningChainResult = await planningPrompt.pipe(model).invoke({
      goal: state.goal
    });
    
    let planData: { reasoning: string; confidenceScore?: number; subGoals: any[] };
    try {
      // Extract the JSON part from the LLM response
      const jsonMatch = planningChainResult.content.match(/```json\n([\s\S]*?)\n```/) || 
                       planningChainResult.content.match(/```\n([\s\S]*?)\n```/) || 
                       planningChainResult.content.match(/\{[\s\S]*\}/);
                       
      const jsonString = jsonMatch ? jsonMatch[0] : planningChainResult.content;
      planData = JSON.parse(jsonString);
    } catch (e) {
      // Fallback if JSON parsing fails
      taskLogger.logAction("Error parsing JSON from LLM response", { error: String(e) });
      
      // Try to create a more basic plan
      planData = {
        reasoning: "Automatically generated plan due to parsing error",
        confidenceScore: 0.5, // Lower confidence for fallback plans
        subGoals: [
          {
            id: "goal_1",
            description: `Complete the goal: ${state.goal}`,
            priority: 1,
            reasoning: "This is the main objective"
          }
        ]
      };
    }
    
    // Process sub-goals recursively to ensure proper hierarchical structure
    const processSubGoals = (subGoals: any[], parentId?: string, depth: number = 0): SubGoal[] => {
      return subGoals.map((sg: any) => {
        // Create the base sub-goal
        const subGoal: SubGoal = {
          id: sg.id || `goal_${Math.random().toString(36).substring(2, 7)}`,
          description: sg.description,
          priority: sg.priority || 3,
          status: 'pending' as const,
          reasoning: sg.reasoning,
          depth,
          parentId
        };
        
        // Process children if they exist
        if (sg.children && Array.isArray(sg.children) && sg.children.length > 0) {
          subGoal.children = processSubGoals(sg.children, subGoal.id, depth + 1);
        }
        
        return subGoal;
      }).sort((a, b) => a.priority - b.priority);
    };
    
    // Create sorted sub-goals with hierarchy
    const subGoals: SubGoal[] = processSubGoals(planData.subGoals);
    
    // Create the planning task
    const planningTask: PlannedTask = {
      goal: state.goal,
      subGoals,
      reasoning: planData.reasoning,
      status: 'planning',
      confidenceScore: planData.confidenceScore || 0.8, // Default to 0.8 confidence if not provided
      metadata: {
        priorityScore: taskPriority.priorityScore,
        priorityTags: taskPriority.priorityTags,
        priorityReasoning: taskPriority.reasoning,
        priorityLevel: formatPriorityLevel(taskPriority.priorityScore)
      }
    };
    
    // Add task metadata if available in the planData
    if ('type' in planData) {
      planningTask.type = planData.type as string;
    }
    
    if ('isStrategic' in planData) {
      planningTask.isStrategic = Boolean(planData.isStrategic);
    }
    
    if ('toolName' in planData) {
      planningTask.toolName = planData.toolName as string;
    }
    
    // Use priority score to determine if this task requires more resources or attention
    // High priority tasks may need more attention
    if (taskPriority.priorityScore >= 75) {
      planningTask.requiresDetailedPlanning = true;
      
      // For very high priority tasks, we might want to expand planning depth
      if (taskPriority.priorityScore >= 90) {
        planningTask.isStrategic = true; // Mark as strategic regardless of other factors
      }
    }
    
    // Check if the task requires approval
    const requiresApproval = HumanCollaboration.checkIfApprovalRequired(planningTask);
    // Also require approval for very high priority tasks
    const requirePriorityBasedApproval = taskPriority.priorityScore >= 85;
    
    if (requiresApproval || requirePriorityBasedApproval) {
      planningTask.requiresApproval = true;
      taskLogger.logAction("Task requires approval", { 
        type: planningTask.type,
        isStrategic: planningTask.isStrategic,
        toolName: planningTask.toolName,
        priorityScore: taskPriority.priorityScore,
        requirePriorityBasedApproval
      });
    }
    
    // Check if the task requires clarification
    const needsClarification = await HumanCollaboration.checkNeedClarification(planningTask);
    
    if (needsClarification) {
      // Generate clarification questions
      const clarificationQuestions = await HumanCollaboration.generateClarificationQuestions(planningTask);
      
      // Update the task status and add clarification questions
      planningTask.status = 'awaiting_clarification';
      planningTask.needsClarification = true;
      planningTask.clarificationQuestions = clarificationQuestions;
      
      taskLogger.logAction("Task needs clarification", { 
        questions: clarificationQuestions,
        confidenceScore: planningTask.confidenceScore
      });
      
      // Create messages for requesting clarification, with stakeholder-aware tone
      const clarificationRequestContent = HumanCollaboration.formatClarificationRequest(
        planningTask,
        clarificationQuestions,
        planningTask.stakeholderProfile
      );
      
      const clarificationMessage = new AIMessage({
        content: clarificationRequestContent
      });
      
      // Create trace entry for clarification request
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const traceEntry: ExecutionTraceEntry = {
        step: "Requesting task clarification",
        startTime,
        endTime,
        duration,
        status: 'info',
        details: {
          questions: clarificationQuestions,
          confidenceScore: planningTask.confidenceScore,
          stakeholderProfile: planningTask.stakeholderProfile?.id || 'default'
        }
      };
      
      // Return the state with awaiting_clarification status
      return {
        ...state,
        task: planningTask,
        messages: [...state.messages, clarificationMessage],
        executionTrace: [...state.executionTrace, traceEntry],
        route: 'request-clarification' // Set a special route for the decision node
      };
    }
    
    // If no clarification needed, proceed normally
    // Log the created plan
    taskLogger.logAction("Created task plan", { 
      subGoals: subGoals.length,
      hasHierarchy: subGoals.some(sg => sg.children && sg.children.length > 0),
      reasoning: planData.reasoning.substring(0, 100) + "...",
      priorityScore: taskPriority.priorityScore
    });
    
    // Helper function to format sub-goals in a hierarchical way
    const formatSubGoalsHierarchy = (subGoals: SubGoal[], indent: string = ""): string => {
      return subGoals.map(sg => {
        let output = `${indent}- ${sg.description} (Priority: ${sg.priority})`;
        if (sg.children && sg.children.length > 0) {
          output += "\n" + formatSubGoalsHierarchy(sg.children, indent + "  ");
        }
        return output;
      }).join('\n');
    };
    
    // Create messages for the plan, including priority level
    const planMessage = new AIMessage({
      content: `I've analyzed your goal and created a plan with ${subGoals.length} main sub-goals:\n\n` +
        `Strategic Priority: ${priorityLevel} (${taskPriority.priorityScore}/100)\n` +
        `Priority Factors: ${taskPriority.priorityTags.join(", ")}\n\n` +
        formatSubGoalsHierarchy(subGoals)
    });
    
    // After successful planning, add this task to the knowledge graph
    try {
      // Create a node for this task
      await graph.addNode({
        id: taskNodeId,
        label: state.goal,
        type: 'task',
        description: planData.reasoning.substring(0, 200), // Brief description from reasoning
        metadata: {
          createdAt: new Date().toISOString(),
          subGoalCount: subGoals.length,
          priorityScore: taskPriority.priorityScore,
          priorityTags: taskPriority.priorityTags
        }
      });
      
      // Connect this task to related nodes if any were found
      for (const relatedNode of relatedNodes) {
        await graph.addEdge({
          from: taskNodeId,
          to: relatedNode.id,
          type: 'related_to',
          label: 'Related to'
        });
      }
      
      // Log the graph update
      taskLogger.logAction("Updated knowledge graph", { 
        taskNodeId,
        relatedNodesCount: relatedNodes.length
      });
    } catch (graphError) {
      // Non-critical error - log but continue
      taskLogger.logAction("Error updating knowledge graph", { error: String(graphError) });
    }
    
    // Calculate duration and create trace entry
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const traceEntry: ExecutionTraceEntry = {
      step: "Task planning completed successfully",
      startTime,
      endTime,
      duration,
      status: 'success',
      details: {
        subGoalsCreated: subGoals.length,
        hasNestedSubGoals: subGoals.some(sg => sg.children && sg.children.length > 0),
        knowledgeGraphUpdated: true,
        relatedNodesCount: relatedNodes.length,
        priorityScore: taskPriority.priorityScore,
        priorityLevel
      }
    };
    
    // Update and return the state
    return {
      ...state,
      task: planningTask,
      messages: [...state.messages, planMessage],
      executionTrace: [...state.executionTrace, traceEntry],
    };
  } catch (error) {
    // Calculate duration for error case
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorMessage = error instanceof Error ? error.message : `${error}`;
    taskLogger.logAction("Error in planning task", { error: errorMessage });
    
    const errorTraceEntry: ExecutionTraceEntry = {
      step: `Error in planning: ${errorMessage}`,
      startTime,
      endTime,
      duration,
      status: 'error',
      details: { error: errorMessage }
    };
    
    return {
      ...state,
      error: `Error planning task: ${errorMessage}`,
      executionTrace: [...state.executionTrace, errorTraceEntry],
    };
  }
} 