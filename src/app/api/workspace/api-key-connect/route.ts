import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceProvider } from '../../../../services/database/types';
import { N8nSelfHostedProvider } from '../../../../services/workspace/providers/N8nSelfHostedProvider';

export const runtime = 'nodejs';

interface ApiKeyConnectRequest {
  provider: WorkspaceProvider;
  apiKeyData: string; // For N8N: "apiKey:instanceUrl"
  userId?: string;
  organizationId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ApiKeyConnectRequest = await request.json();

    // Validate required fields
    if (!body.provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    if (!body.apiKeyData) {
      return NextResponse.json(
        { error: 'API key data is required' },
        { status: 400 }
      );
    }

    // Only support N8N Self-Hosted for now
    if (body.provider !== WorkspaceProvider.N8N_SELF_HOSTED) {
      return NextResponse.json(
        { error: 'Only N8N Self-Hosted provider is supported for API key connections' },
        { status: 400 }
      );
    }

    try {
      console.log('Creating N8N Self-Hosted connection with API key');

      // Create state data for the provider
      const stateData = {
        userId: body.userId,
        organizationId: body.organizationId,
        provider: body.provider,
        timestamp: Date.now()
      };
      const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

      // Use the N8N Self-Hosted provider to complete the connection
      const n8nSelfHostedProvider = new N8nSelfHostedProvider();
      const connection = await n8nSelfHostedProvider.completeConnection(body.apiKeyData, state);

      console.log('N8N Self-Hosted connection created successfully:', {
        connectionId: connection.id,
        email: connection.email,
        provider: connection.provider
      });

      return NextResponse.json({
        success: true,
        connection: {
          id: connection.id,
          provider: connection.provider,
          email: connection.email,
          displayName: connection.displayName,
          status: connection.status
        }
      });

    } catch (connectionError) {
      console.error('Error creating N8N Self-Hosted connection:', connectionError);

      return NextResponse.json(
        {
          error: 'Failed to create connection',
          details: connectionError instanceof Error ? connectionError.message : 'Unknown error'
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in API key connect endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
} 