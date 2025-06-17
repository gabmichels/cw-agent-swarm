import { NextRequest, NextResponse } from 'next/server';
import { MultiTenantTwitterProvider } from '@/services/social-media/providers/MultiTenantTwitterProvider';
import { PrismaStateStorage } from '@/services/social-media/providers/base/PrismaStateStorage';
import { PrismaSocialMediaDatabase } from '@/services/social-media/database/PrismaSocialMediaDatabase';
import { PrismaClient } from '@prisma/client';
import { SocialMediaProvider, SocialMediaConnectionStatus } from '@/services/social-media/database/ISocialMediaDatabase';

/**
 * GET /api/social-media/callback/twitter
 * 
 * Handles OAuth callback from Twitter
 * 
 * Query params:
 * - code: Authorization code from Twitter
 * - state: State parameter for security validation
 * 
 * This endpoint:
 * 1. Validates the state parameter
 * 2. Exchanges the code for access tokens
 * 3. Stores the tokens securely in the database
 * 4. Redirects back to the application
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const prisma = new PrismaClient();
  const stateStorage = new PrismaStateStorage(prisma);
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('Twitter OAuth error:', error);
      return NextResponse.redirect(
        `${baseUrl}/?social_error=${encodeURIComponent(error)}&platform=twitter`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/?social_error=missing_parameters&platform=twitter`
      );
    }

    // Initialize Twitter provider
    const twitterProvider = new MultiTenantTwitterProvider();

    console.log('Callback received state:', state);

    // Get state data from database
    const stateData = await stateStorage.get(state);
    if (!stateData) {
      console.error('State not found in database. State:', state);
      return NextResponse.redirect(
        `${baseUrl}/?social_error=invalid_state&platform=twitter`
      );
    }

    const { tenantId, userId } = stateData;

    console.log('Processing OAuth callback with:', { code, state, tenantId, userId });

    // Exchange code for tokens using Twitter's custom method that supports PKCE
    const tokenResponse = await twitterProvider.exchangeCodeForTokenWithState(code, state);
    
    console.log('Token exchange successful');

    // Get user profile information
    const userProfile = await twitterProvider.getUserProfile(tokenResponse.access_token);

    console.log('User profile retrieved:', {
      id: userProfile.id,
      name: userProfile.name,
      username: userProfile.username
    });

    // Initialize database
    const database = new PrismaSocialMediaDatabase(prisma);

    // Store the connection in database
    const connection = await database.createConnection({
      userId,
      organizationId: tenantId !== userId ? tenantId : undefined,
      provider: SocialMediaProvider.TWITTER,
      providerAccountId: userProfile.id,
      accountDisplayName: userProfile.name,
      accountUsername: userProfile.username,
      accountType: (stateData.accountType || 'personal') as 'personal' | 'business',
      encryptedCredentials: {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_in: tokenResponse.expires_in,
        token_type: tokenResponse.token_type
      },
      scopes: ['tweet.read', 'tweet.write', 'users.read'], // Twitter OAuth 2.0 default scopes
      connectionStatus: SocialMediaConnectionStatus.ACTIVE,
      metadata: {
        followerCount: 0, // Would need additional API call to get this
        verifiedStatus: false, // Would need additional API call to get this
        accountCreated: new Date().toISOString()
      },
      lastValidated: new Date()
    });

    console.log('Twitter connection stored successfully in database:', {
      connectionId: connection.id,
      tenantId,
      accountUsername: connection.accountUsername,
      accountType: connection.accountType
    });

    // Log the successful connection
    await database.logAction({
      timestamp: new Date(),
      connectionId: connection.id,
      agentId: undefined,
      action: 'authenticate',
      platform: SocialMediaProvider.TWITTER,
      result: 'success',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        accountType: connection.accountType,
        scopes: connection.scopes
      }
    });

    const redirectUrl = `${baseUrl}/?social_success=true&platform=twitter&account=${encodeURIComponent(connection.accountDisplayName)}`;
    console.log('Redirecting to:', redirectUrl);

    // Clean up the state
    await stateStorage.delete(state);

    // Redirect back to main page with success message
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('Twitter callback error:', error);
    
    return NextResponse.redirect(
      `${baseUrl}/?social_error=${encodeURIComponent(
        error instanceof Error ? error.message : 'connection_failed'
      )}&platform=twitter`
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Example of how the state parameter would be structured:
 * 
 * const stateData = {
 *   tenantId: "tenant_01HQ7X8Z9Y2K3L4M5N6P7Q8R9S",
 *   userId: "user_01HQ7X8Z9Y2K3L4M5N6P7Q8R9T", 
 *   accountType: "company",
 *   timestamp: 1703123456789,
 *   codeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
 * };
 */ 