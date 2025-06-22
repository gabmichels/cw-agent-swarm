/**
 * /api/workflows/suggestions - Workflow suggestion endpoint
 * 
 * Provides AI-powered workflow suggestions based on user messages.
 * Integrates with WorkflowTriggerService for intelligent workflow matching.
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowTriggerService } from '../../../../services/agents/WorkflowTriggerService';
import { AgentWorkflowStorage } from '../../../../services/external-workflows/storage/AgentWorkflowStorage';
import { N8nService } from '../../../../services/external-workflows/N8nService';
import { ZapierService } from '../../../../services/external-workflows/ZapierService';

/**
 * Workflow suggestion request
 */
interface WorkflowSuggestionRequest {
  agentId: string;
  userMessage: string;
  chatId?: string;
  userId?: string;
}

/**
 * Workflow suggestion response
 */
interface WorkflowSuggestionResponse {
  suggestions: Array<{
    suggestionId: string;
    workflowId: string;
    workflowName: string;
    platform: 'n8n' | 'zapier';
    confidence: number;
    matchedTriggers: string[];
    suggestedParams: Record<string, unknown>;
    description: string;
    estimatedDurationMs: number;
    recommendedAction: 'execute' | 'confirm' | 'clarify' | 'ignore';
    reasoning: string;
  }>;
  totalMatches: number;
  processingTimeMs: number;
}

/**
 * Initialize services (in a real app, these would be dependency injected)
 */
function initializeServices() {
  // These would be properly configured with actual service instances
  const workflowStorage = new AgentWorkflowStorage({} as any);
  const n8nService = new N8nService({} as any);
  const zapierService = new ZapierService({} as any);
  
  return new WorkflowTriggerService(
    workflowStorage,
    n8nService,
    zapierService,
    {
      confidenceThresholds: {
        autoExecute: 0.85,
        confirmationRequired: 0.65,
        suggestion: 0.40
      },
      entityExtraction: {
        enabled: true,
        patterns: {
          email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          url: /https?:\/\/[^\s]+/g,
          number: /\b\d+(?:\.\d+)?\b/g,
          date: /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g
        }
      },
      rateLimiting: {
        enabled: true,
        maxExecutionsPerMinute: 20,
        maxExecutionsPerHour: 200
      }
    }
  );
}

/**
 * POST /api/workflows/suggestions
 * Get workflow suggestions for a user message
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: WorkflowSuggestionRequest = await request.json();
    
    // Validate request
    if (!body.agentId || !body.userMessage) {
      return NextResponse.json(
        { error: 'agentId and userMessage are required' },
        { status: 400 }
      );
    }

    if (body.userMessage.length < 3) {
      return NextResponse.json(
        { error: 'userMessage must be at least 3 characters long' },
        { status: 400 }
      );
    }

    // Initialize workflow trigger service
    const workflowTriggerService = initializeServices();

    // Get workflow trigger match
    const triggerMatch = await workflowTriggerService.processUserMessage(
      body.agentId,
      body.userMessage,
      {
        userId: body.userId,
        sessionId: body.chatId,
        skipRateLimit: false
      }
    );

    const suggestions: WorkflowSuggestionResponse['suggestions'] = [];

    if (triggerMatch) {
      // Generate workflow suggestion
      const suggestion = await workflowTriggerService.generateWorkflowSuggestion(
        body.agentId,
        body.userMessage,
        [triggerMatch]
      );

      suggestions.push({
        suggestionId: suggestion.suggestionId,
        workflowId: triggerMatch.workflow.id.toString(),
        workflowName: triggerMatch.workflow.name,
        platform: triggerMatch.workflow.platform,
        confidence: triggerMatch.confidence,
        matchedTriggers: Array.from(triggerMatch.matchedTriggers),
        suggestedParams: triggerMatch.suggestedParams,
        description: triggerMatch.workflow.description,
        estimatedDurationMs: triggerMatch.workflow.estimatedDurationMs,
        recommendedAction: suggestion.recommendedAction,
        reasoning: suggestion.reasoning
      });
    }

    const processingTimeMs = Date.now() - startTime;

    const response: WorkflowSuggestionResponse = {
      suggestions,
      totalMatches: suggestions.length,
      processingTimeMs
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error generating workflow suggestions:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate workflow suggestions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workflows/suggestions
 * Get recent workflow suggestions for an agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId parameter is required' },
        { status: 400 }
      );
    }

    // In a real implementation, this would fetch recent suggestions from storage
    // For now, return empty array
    const response = {
      suggestions: [],
      totalMatches: 0,
      processingTimeMs: 0
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching workflow suggestions:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch workflow suggestions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 