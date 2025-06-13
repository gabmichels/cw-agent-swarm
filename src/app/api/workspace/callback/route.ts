import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '../../../../services/workspace/WorkspaceService';
import { WorkspaceProvider } from '../../../../services/database/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const provider = searchParams.get('provider') || WorkspaceProvider.GOOGLE_WORKSPACE;

    // Debug logging
    console.log('OAuth callback received:', {
      code: code ? 'present' : 'missing',
      state: state ? 'present' : 'missing',
      error,
      provider,
      url: request.url
    });

    // Handle OAuth error
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code) {
      console.error('Missing OAuth code parameter');
      return NextResponse.redirect(
        new URL('/?error=missing_oauth_parameters', request.url)
      );
    }

    // Initialize workspace service
    const workspaceService = new WorkspaceService();

    try {
      console.log('Attempting to complete connection for provider:', provider);
      
      // Decode state parameter to get user info
      let stateData: any = {};
      if (state) {
        try {
          stateData = JSON.parse(Buffer.from(state, 'base64').toString());
          console.log('Decoded state data:', stateData);
        } catch (error) {
          console.warn('Failed to decode state parameter:', error);
        }
      }
      
      // Complete the connection
      const connection = await workspaceService.completeConnection(
        provider as WorkspaceProvider,
        code,
        state || '',
        stateData.userId,
        stateData.organizationId
      );

      console.log('Connection completed successfully:', connection.id);
      
      // Redirect to success page with connection info
      return NextResponse.redirect(
        new URL(`/?workspace_connected=${connection.id}&provider=${provider}`, request.url)
      );

    } catch (connectionError) {
      console.error('Error completing workspace connection:', connectionError);
      console.error('Error details:', {
        message: connectionError instanceof Error ? connectionError.message : 'Unknown error',
        stack: connectionError instanceof Error ? connectionError.stack : undefined,
        provider,
        codePresent: !!code,
        statePresent: !!state
      });
      
      return NextResponse.redirect(
        new URL(`/?error=connection_failed&provider=${provider}&details=${encodeURIComponent(connectionError instanceof Error ? connectionError.message : 'Unknown error')}`, request.url)
      );
    }

  } catch (error) {
    console.error('Error in workspace callback:', error);
    return NextResponse.redirect(
      new URL('/?error=callback_error', request.url)
    );
  }
} 