import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { AgentRegistrationRequest, AgentProfile } from '@/lib/multi-agent/types/agent';

/**
 * POST /api/multi-agent/agents
 * Registers a new agent in the system
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const requestData: AgentRegistrationRequest = await request.json();
    
    // Validate request data
    if (!requestData.name) {
      return NextResponse.json(
        { success: false, error: 'Agent name is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.description) {
      return NextResponse.json(
        { success: false, error: 'Agent description is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.capabilities || requestData.capabilities.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one capability is required' },
        { status: 400 }
      );
    }
    
    // Generate a new agent ID using ULID for sortable, unique IDs
    const timestamp = new Date();
    const id = `agent_${requestData.name.toLowerCase().replace(/\s+/g, '_')}_${ulid(timestamp.getTime())}`;
    
    // Create agent profile
    const agent: AgentProfile = {
      id,
      name: requestData.name,
      description: requestData.description,
      status: requestData.status,
      capabilities: requestData.capabilities,
      parameters: requestData.parameters,
      metadata: requestData.metadata,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // TODO: Store agent data in the database
    // This will be implemented when the database infrastructure is ready
    // For now, we're just returning a successful response with the created agent
    
    return NextResponse.json({
      success: true,
      message: 'Agent registered successfully',
      agent
    });
  } catch (error) {
    console.error('Error registering agent:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/multi-agent/agents
 * Retrieves a list of registered agents
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const nameParam = searchParams.get('name');
    const tagsParam = searchParams.get('tags');
    const statusParam = searchParams.get('status');
    
    // TODO: Implement database query to fetch agents
    // For now, return a mock empty list since we don't have storage yet
    
    return NextResponse.json({
      success: true,
      agents: [],
      total: 0,
      page: 1,
      pageSize: 10
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
} 