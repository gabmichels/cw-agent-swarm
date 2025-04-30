/**
 * Strategic Tool Planner for Chloe
 * 
 * Handles task prioritization based on strategic value and business impact.
 * Used to influence task planning, resource allocation, and execution sequencing.
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';

export interface PriorityAssessment {
  priorityScore: number; // 0-100 score
  priorityTags: string[]; // e.g., ["market_trend", "revenue_potential"]
  reasoning: string; // Explanation for the priority assessment
}

export interface TaskPriorityOptions {
  // Business context factors
  businessGoals?: string[];
  marketTrends?: string[];
  stakeholderPriorities?: Record<string, number>;
  
  // Resource constraints
  availableTime?: number; // in minutes
  teamSize?: number;
  
  // Previous context
  recentTasks?: Array<{goal: string; priority: number}>;
}

export class StrategicToolPlanner {
  private model: ChatOpenAI;
  private businessGoals: string[];
  private marketPriorities: Record<string, number>;
  
  constructor(options: {
    model: ChatOpenAI;
    businessGoals?: string[];
    marketPriorities?: Record<string, number>;
  }) {
    this.model = options.model;
    this.businessGoals = options.businessGoals || [
      "Increase market share by 10%",
      "Improve customer satisfaction scores",
      "Optimize marketing ROI",
      "Build brand awareness",
      "Launch new product lines",
    ];
    this.marketPriorities = options.marketPriorities || {
      "revenue_generation": 80,
      "customer_acquisition": 75,
      "brand_reputation": 70,
      "market_research": 65,
      "competitor_analysis": 60,
      "content_creation": 55,
      "social_media": 50,
      "website_optimization": 60,
      "email_marketing": 55,
      "analytics": 65,
    };
  }
  
  /**
   * Assess a task's strategic priority based on its goal and description
   * @param task Task to assess
   * @param options Additional context for priority assessment
   * @returns Priority assessment with score and tags
   */
  async assessTaskPriority(
    task: { goal: string; description?: string; type?: string },
    options: TaskPriorityOptions = {}
  ): Promise<PriorityAssessment> {
    // For quick tasks without needing LLM, use heuristic assessment
    if (task.type && this.isSimpleTask(task.type)) {
      return this.quickHeuristicAssessment(task);
    }
    
    // For more complex tasks, use LLM-based assessment
    const template = `
You are a strategic business advisor evaluating the priority of a marketing task.

TASK GOAL: {goal}
TASK DESCRIPTION: {description}

BUSINESS GOALS:
{businessGoals}

CURRENT MARKET PRIORITIES:
{marketPriorities}

Please assess the strategic priority of this task by considering:
1. Alignment with business goals
2. Potential market impact
3. Revenue or growth potential
4. Urgency based on market trends
5. Resource efficiency

Provide your assessment in the following JSON format:
{
  "priorityScore": <number between 0-100>,
  "priorityTags": ["tag1", "tag2"],
  "reasoning": "Explanation of why this task received this priority score"
}

Priority score guidelines:
- 80-100: Critical strategic priority with direct business impact
- 60-79: High strategic value, should be prioritized
- 40-59: Moderate strategic relevance
- 20-39: Low strategic priority but still valuable
- 0-19: Minimal strategic value, consider deferring

Response (JSON format only):`;
    
    const promptTemplate = ChatPromptTemplate.fromTemplate(template);
    
    // Format business goals as bullet points
    const businessGoalsFormatted = this.businessGoals
      .map(goal => `• ${goal}`)
      .join("\n");
    
    // Format market priorities as bullet points with scores
    const marketPrioritiesFormatted = Object.entries(this.marketPriorities)
      .map(([key, value]) => `• ${key.replace(/_/g, " ")}: ${value}/100`)
      .join("\n");
    
    try {
      const response = await promptTemplate.pipe(this.model).invoke({
        goal: task.goal,
        description: task.description || "No additional description provided.",
        businessGoals: businessGoalsFormatted,
        marketPriorities: marketPrioritiesFormatted,
      });
      
      // Parse the result, which should be JSON
      const content = response.content.toString();
      const jsonString = content.match(/\{[\s\S]*\}/)?.[0] || content;
      const assessment = JSON.parse(jsonString);
      
      return {
        priorityScore: assessment.priorityScore,
        priorityTags: assessment.priorityTags,
        reasoning: assessment.reasoning,
      };
    } catch (error) {
      console.error("Error assessing task priority:", error);
      
      // Return a fallback assessment
      return {
        priorityScore: 50, // Neutral priority
        priorityTags: ["default"],
        reasoning: "Unable to perform detailed assessment due to error.",
      };
    }
  }
  
  /**
   * Assess the priority of a specific tool plan
   * @param toolPlan Tool plan to assess
   * @returns Priority assessment
   */
  async assessToolPlan(
    toolPlan: { name: string; description: string; goal?: string }
  ): Promise<PriorityAssessment> {
    // Similar approach as assessTaskPriority but focused on tools
    return this.assessTaskPriority(
      { 
        goal: toolPlan.goal || `Using ${toolPlan.name}`, 
        description: toolPlan.description,
        type: "tool_plan" 
      }
    );
  }
  
  /**
   * Quick heuristic assessment for simple tasks without LLM
   */
  private quickHeuristicAssessment(
    task: { goal: string; type?: string }
  ): PriorityAssessment {
    const lowerGoal = task.goal.toLowerCase();
    
    // Simple keyword-based scoring
    let score = 50; // Default moderate score
    const tags = [];
    
    // Check for high-priority keywords
    if (
      lowerGoal.includes("revenue") || 
      lowerGoal.includes("sales") || 
      lowerGoal.includes("urgent") ||
      lowerGoal.includes("critical")
    ) {
      score += 30;
      tags.push("revenue_impact", "high_urgency");
    }
    
    // Check for strategic keywords
    if (
      lowerGoal.includes("strategy") || 
      lowerGoal.includes("roadmap") || 
      lowerGoal.includes("planning")
    ) {
      score += 20;
      tags.push("strategic_planning");
    }
    
    // Check for market-related keywords
    if (
      lowerGoal.includes("market") || 
      lowerGoal.includes("competitor") || 
      lowerGoal.includes("trend")
    ) {
      score += 15;
      tags.push("market_insight");
    }
    
    // Check for content or communication tasks (generally lower priority)
    if (
      lowerGoal.includes("content") || 
      lowerGoal.includes("write") || 
      lowerGoal.includes("draft") ||
      lowerGoal.includes("email")
    ) {
      score -= 10;
      tags.push("content_creation");
    }
    
    // Cap score at 0-100
    score = Math.min(100, Math.max(0, score));
    
    return {
      priorityScore: score,
      priorityTags: tags,
      reasoning: `Quick assessment based on keywords in task: ${task.goal}`
    };
  }
  
  /**
   * Determine if a task is simple enough for heuristic assessment
   */
  private isSimpleTask(taskType: string): boolean {
    const simpleTypes = [
      "content_creation",
      "data_collection",
      "simple_research",
      "email_draft",
      "meeting_notes",
      "status_update"
    ];
    
    return simpleTypes.includes(taskType.toLowerCase());
  }
  
  /**
   * Update business goals to reflect current priorities
   */
  updateBusinessGoals(goals: string[]): void {
    this.businessGoals = goals;
  }
  
  /**
   * Update market priorities with new scoring
   */
  updateMarketPriorities(priorities: Record<string, number>): void {
    this.marketPriorities = priorities;
  }
}

/**
 * Helper method to format priority as a descriptive string
 */
export function formatPriorityLevel(score: number): string {
  if (score >= 80) return "Critical Priority";
  if (score >= 60) return "High Priority";
  if (score >= 40) return "Medium Priority";
  if (score >= 20) return "Low Priority";
  return "Minimal Priority";
} 