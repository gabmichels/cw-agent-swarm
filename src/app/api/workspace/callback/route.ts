import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceProvider } from '../../../../services/database/types';
import { GoogleWorkspaceProvider } from '../../../../services/workspace/providers/GoogleWorkspaceProvider';
import { N8nCloudProvider } from '../../../../services/workspace/providers/N8nCloudProvider';
import { ZohoWorkspaceProvider } from '../../../../services/workspace/providers/ZohoWorkspaceProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    let provider = searchParams.get('provider') || WorkspaceProvider.GOOGLE_WORKSPACE;

    // Try to determine provider from state parameter if not explicitly provided
    if (state && !searchParams.get('provider')) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        if (stateData.provider) {
          provider = stateData.provider;
        }
      } catch (error) {
        console.warn('Failed to decode state parameter for provider detection:', error);
      }
    }

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

      // Get the appropriate provider and complete the connection
      let connection;

      switch (provider as WorkspaceProvider) {
        case WorkspaceProvider.GOOGLE_WORKSPACE:
          const googleProvider = new GoogleWorkspaceProvider();
          connection = await googleProvider.completeConnection(code, state || '');
          break;

        case WorkspaceProvider.ZOHO:
          const zohoProvider = new ZohoWorkspaceProvider();
          connection = await zohoProvider.completeConnection(code, state || '');
          break;

        case WorkspaceProvider.N8N_CLOUD:
          const n8nCloudProvider = new N8nCloudProvider();
          connection = await n8nCloudProvider.completeConnection(code, state || '');
          break;

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      console.log('Connection completed successfully:', {
        connectionId: connection.id,
        provider: connection.provider,
        email: connection.email
      });

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