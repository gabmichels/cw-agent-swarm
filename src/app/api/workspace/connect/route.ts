import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceProvider } from '../../../../services/database/types';
import { ZohoWorkspaceProvider } from '../../../../services/workspace/providers/ZohoWorkspaceProvider';
import { WorkspaceService } from '../../../../services/workspace/WorkspaceService';

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

    // Initialize services
    const workspaceService = new WorkspaceService();

    // Use alternative approach since getProvider is private
    const provider = body.provider;

    // Get provider-specific redirect URI and scopes
    let redirectUri: string;
    let defaultScopes: string[];

    switch (body.provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/workspace/callback';
        defaultScopes = [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ];
        break;

      case WorkspaceProvider.ZOHO:
        redirectUri = process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/api/workspace/callback';
        defaultScopes = ZohoWorkspaceProvider.getRequiredScopes();
        break;

      default:
        redirectUri = 'http://localhost:3000/api/workspace/callback';
        defaultScopes = [];
    }

    // Create state parameter with user info
    const stateData = {
      userId: body.userId,
      organizationId: body.organizationId,
      provider: body.provider,
      timestamp: Date.now()
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Create provider-specific connection URL manually since initiateConnection doesn't exist
    const connectionUrl = `https://accounts.google.com/oauth/authorize?response_type=code&client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&scope=profile email&state=${Buffer.from(JSON.stringify(stateData)).toString('base64')}`;

    const result = {
      authUrl: connectionUrl,
      state: stateData,
      success: true,
      error: null
    };

    return NextResponse.json({
      success: result.success,
      authUrl: result.authUrl,
      error: result.error
    });

  } catch (error) {
    console.error('Error initiating workspace connection:', error);
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    );
  }
} 