import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceProviderSelector } from '../../../../services/workspace/providers/WorkspaceProviderSelector';
import { WorkspaceCapabilityType } from '../../../../services/database/types';

interface ProviderSelectionRequest {
  agentId: string;
  capability: WorkspaceCapabilityType;
  recipientEmails?: string[];
  senderEmail?: string;
  domain?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ProviderSelectionRequest = await request.json();
    
    // Validate required fields
    if (!body.agentId || !body.capability) {
      return NextResponse.json(
        { error: 'Agent ID and capability are required' },
        { status: 400 }
      );
    }

    const selector = new WorkspaceProviderSelector();
    
    const selection = await selector.selectBestProvider({
      agentId: body.agentId,
      capability: body.capability,
      recipientEmails: body.recipientEmails,
      senderEmail: body.senderEmail,
      domain: body.domain
    });

    if (!selection) {
      return NextResponse.json({
        success: false,
        message: 'No suitable workspace connection found',
        selection: null
      });
    }

    return NextResponse.json({
      success: true,
      selection: {
        connectionId: selection.connectionId,
        provider: selection.connection.provider,
        email: selection.connection.email,
        displayName: selection.connection.displayName,
        reason: selection.reason,
        confidence: selection.confidence
      }
    });

  } catch (error) {
    console.error('Error in provider selection:', error);
    return NextResponse.json(
      { 
        error: 'Failed to select provider',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  
  if (!agentId) {
    return NextResponse.json(
      { error: 'Agent ID is required' },
      { status: 400 }
    );
  }

  try {
    const selector = new WorkspaceProviderSelector();
    
    // Get available connections for this agent
    const capabilities = await selector['permissionService'].getAgentWorkspaceCapabilities(agentId);
    
    const availableConnections = capabilities.map(cap => ({
      connectionId: cap.connectionId,
      provider: cap.provider,
      connectionName: cap.connectionName,
      capability: cap.capability,
      accessLevel: cap.accessLevel
    }));

    return NextResponse.json({
      success: true,
      availableConnections
    });

  } catch (error) {
    console.error('Error getting available connections:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get available connections',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 