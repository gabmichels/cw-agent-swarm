import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceProvider } from '../../../../services/database/types';
import { getRequiredScopes } from '../../../../services/workspace/scopes/WorkspaceScopes';
import { GoogleWorkspaceProvider } from '../../../../services/workspace/providers/GoogleWorkspaceProvider';
import { ZohoWorkspaceProvider } from '../../../../services/workspace/providers/ZohoWorkspaceProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConnectRequest {
  provider: WorkspaceProvider;
  userId?: string;
  organizationId?: string;
  scopes?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ConnectRequest = await request.json();

    // Validate required fields
    if (!body.provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Validate provider is supported
    if (!Object.values(WorkspaceProvider).includes(body.provider)) {
      return NextResponse.json(
        { error: 'Unsupported provider' },
        { status: 400 }
      );
    }

    console.log(`OAuth connection requested for provider: ${body.provider}`);

    // Get provider-specific redirect URI and scopes
    const redirectUri = process.env.WORKSPACE_REDIRECT_URI ||
      `${process.env.BASE_URL || 'http://localhost:3000'}/api/workspace/callback`;
    const defaultScopes = body.scopes || getRequiredScopes(body.provider);

    console.log('OAuth config:', {
      provider: body.provider,
      redirectUri: redirectUri.substring(0, 50) + '...',
      scopeCount: defaultScopes.length
    });

    // Create state parameter with user info
    const stateData = {
      userId: body.userId,
      organizationId: body.organizationId,
      provider: body.provider,
      timestamp: Date.now()
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Get the appropriate provider and initiate connection
    let result;

    try {
      switch (body.provider) {
        case WorkspaceProvider.GOOGLE_WORKSPACE:
          const googleProvider = new GoogleWorkspaceProvider();
          result = await googleProvider.initiateConnection({
            scopes: defaultScopes,
            redirectUri,
            state
          });
          break;

        case WorkspaceProvider.ZOHO:
          const zohoProvider = new ZohoWorkspaceProvider();
          result = await zohoProvider.initiateConnection({
            scopes: defaultScopes,
            redirectUri,
            state
          });
          break;

        default:
          throw new Error(`Unsupported provider: ${body.provider}`);
      }

      if (!result.success) {
        console.error(`OAuth initiation failed for ${body.provider}:`, result.error);
        return NextResponse.json(
          { error: result.error || 'Failed to initiate connection' },
          { status: 500 }
        );
      }

      console.log(`Generated OAuth URL for ${body.provider}: ${result.authUrl?.substring(0, 100)}...`);

      return NextResponse.json({
        success: result.success,
        authUrl: result.authUrl,
        error: result.error
      });

    } catch (providerError) {
      console.error(`Error creating ${body.provider} provider:`, providerError);
      return NextResponse.json(
        { error: `Failed to initialize ${body.provider} provider: ${providerError instanceof Error ? providerError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error initiating workspace connection:', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
} 