import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '../../../../services/workspace/WorkspaceService';
import { DatabaseService } from '../../../../services/database/DatabaseService';
import { WorkspaceProvider } from '../../../../services/database/types';

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

    // Get the provider
    const provider = workspaceService.getProvider(body.provider);
    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not available' },
        { status: 503 }
      );
    }

    // Get the redirect URI from environment or use default
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/workspace/callback';

    // Create state parameter with user info
    const stateData = {
      userId: body.userId,
      organizationId: body.organizationId,
      timestamp: Date.now()
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Initiate connection
    const result = await provider.initiateConnection({
      userId: body.userId,
      organizationId: body.organizationId,
      scopes: body.scopes || [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      redirectUri,
      state
    });

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