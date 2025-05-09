import { NextRequest, NextResponse } from 'next/server';
import { AgentService } from '../../../../services/AgentService';

export const runtime = 'nodejs';

/**
 * Handler for testing the watcher system
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get('message') || 'Test message';
    const agentId = searchParams.get('agentId') || 'chloe';
    
    // Get the agent
    const agent = await AgentService.getAgent(agentId);
    
    if (!agent) {
      return NextResponse.json({ 
        error: `Agent with ID ${agentId} not found` 
      }, { status: 404 });
    }
    
    // Check if the agent has a task logger
    if (!agent.taskLogger) {
      return NextResponse.json({ 
        error: `Agent ${agentId} does not have a task logger` 
      }, { status: 400 });
    }
    
    // Log a test message
    agent.taskLogger.logAction('Test watcher event', { message });
    
    return NextResponse.json({
      success: true,
      message: `Test event dispatched: ${message}`
    });
  } catch (error) {
    console.error('Error in test watcher:', error);
    return NextResponse.json({ 
      error: 'Failed to test watcher' 
    }, { status: 500 });
  }
} 