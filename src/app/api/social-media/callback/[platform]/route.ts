import { NextRequest, NextResponse } from 'next/server';
import { MultiTenantTwitterProvider } from '@/services/social-media/providers/MultiTenantTwitterProvider';
import { MultiTenantLinkedInProvider } from '@/services/social-media/providers/MultiTenantLinkedInProvider';
import { MultiTenantTikTokProvider } from '@/services/social-media/providers/MultiTenantTikTokProvider';
import { MultiTenantFacebookProvider } from '@/services/social-media/providers/MultiTenantFacebookProvider';
import { MultiTenantInstagramProvider } from '@/services/social-media/providers/MultiTenantInstagramProvider';
import { SocialMediaProvider, SocialMediaConnectionStatus } from '@/services/social-media/database/ISocialMediaDatabase';
import { IMultiTenantSocialMediaProvider } from '@/services/social-media/providers/base/MultiTenantProviderBase';

/**
 * Multi-Platform OAuth Callback Handler
 * 
 * Handles OAuth callbacks for all social media platforms
 * Route: /api/social-media/callback/[platform]
 */

// Provider registry
const providers: Record<string, () => IMultiTenantSocialMediaProvider> = {
  twitter: () => new MultiTenantTwitterProvider(),
  linkedin: () => new MultiTenantLinkedInProvider(),
  tiktok: () => new MultiTenantTikTokProvider(),
  facebook: () => new MultiTenantFacebookProvider(),
  instagram: () => new MultiTenantInstagramProvider(),
  // Add more platforms as they're implemented
  // reddit: () => new MultiTenantRedditProvider(),
};

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const { platform } = params;
    const { searchParams } = new URL(request.url);
    
    // Extract OAuth parameters
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error(`OAuth error for ${platform}:`, error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=${encodeURIComponent(error)}&platform=${platform}&source=oauth_error`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=missing_parameters&platform=${platform}&source=oauth_validation`
      );
    }

    // Get provider for platform
    const providerFactory = providers[platform.toLowerCase()];
    if (!providerFactory) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=unsupported_platform&platform=${platform}&source=oauth_provider`
      );
    }

    const provider = providerFactory();

    // Extract tenantId and userId from the stored state data
    // The state parameter contains the original tenant/user info
    let tenantId: string;
    let userId: string;
    
    try {
      // Access the state storage to get the original tenant/user IDs
      // This is a temporary solution - in production you'd handle this more elegantly
      const stateStorage = (provider as any).stateStorage;
      const stateData = await stateStorage.get(state);
      
      if (!stateData) {
        throw new Error('State data not found - OAuth session may have expired');
      }
      
      tenantId = stateData.tenantId;
      userId = stateData.userId;
      
      console.log('Retrieved OAuth state data:', { tenantId, userId, platform });
    } catch (stateError) {
      console.error('Failed to retrieve state data:', stateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=invalid_state&platform=${platform}&details=${encodeURIComponent((stateError as Error).message)}`
      );
    }

    // Handle OAuth callback with correct tenant/user IDs
    const tokenData = await provider.handleOAuthCallback({
      code,
      state,
      tenantId,
      userId
    });

    console.log(`Successfully connected ${platform} account:`, {
      platform: tokenData.platform,
      accountDisplayName: tokenData.accountDisplayName,
      accountUsername: tokenData.accountUsername,
      accountType: tokenData.accountType
    });

    // Store connection in database
    try {
      const { PrismaSocialMediaDatabase } = await import('@/services/social-media/database/PrismaSocialMediaDatabase');
      const { PrismaClient } = await import('@prisma/client');
      const { TokenEncryption } = await import('@/services/security/TokenEncryption');
      
      const prisma = new PrismaClient();
      const database = new PrismaSocialMediaDatabase(prisma);
      const tokenEncryption = new TokenEncryption();
      
      // Convert TenantSocialToken to SocialMediaConnection format
      // Map account types correctly
      const accountType = tokenData.accountType === 'company' ? 'business' : 
                         tokenData.accountType === 'product' ? 'creator' : 
                         'personal';

      // The tokens from multi-tenant provider are encrypted and need to be decrypted
      // then re-encrypted in the format expected by the regular providers
      console.log('🔧 Processing tokens for storage...');
      
      let credentials;
      try {
        const decryptedAccessToken = tokenEncryption.decrypt(tokenData.accessToken);
        const decryptedRefreshToken = tokenData.refreshToken ? tokenEncryption.decrypt(tokenData.refreshToken) : undefined;
        
        console.log('✅ Tokens decrypted successfully');
        console.log('🔑 Access token present:', !!decryptedAccessToken);
        console.log('🔄 Refresh token present:', !!decryptedRefreshToken);
        
        credentials = {
          access_token: decryptedAccessToken,
          refresh_token: decryptedRefreshToken,
          token_type: 'Bearer',
          expires_in: Math.floor((tokenData.expiresAt.getTime() - Date.now()) / 1000),
          scope: tokenData.scopes.join(' ')
        };
      } catch (decryptError) {
        console.error('❌ Token decryption failed:', decryptError);
        throw new Error(`Token decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`);
      }

      // Pass the credentials to the database - it will handle encryption
      const connection = await database.createConnection({
        userId: tokenData.userId,
        organizationId: tokenData.tenantId,
        provider: tokenData.platform,
        providerAccountId: tokenData.accountId,
        accountDisplayName: tokenData.accountDisplayName,
        accountUsername: tokenData.accountUsername,
        accountType: accountType,
        encryptedCredentials: JSON.stringify(credentials), // Database expects string format
        scopes: tokenData.scopes,
        connectionStatus: SocialMediaConnectionStatus.ACTIVE,
        metadata: {},
        lastValidated: new Date()
      });

      console.log(`Successfully stored ${platform} connection in database:`, connection.id);
      await prisma.$disconnect();
    } catch (dbError) {
      console.error('Failed to store connection in database:', dbError);
      // Don't fail the OAuth flow, but log the error
    }

    // Redirect back to home page with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?success=true&platform=${platform}&account=${encodeURIComponent(tokenData.accountDisplayName)}&source=oauth_success`
    );

  } catch (error) {
    console.error(`OAuth callback error for ${params.platform}:`, error);
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=callback_failed&platform=${params.platform}&details=${encodeURIComponent((error as Error).message)}&source=oauth_callback`
    );
  }
}

/**
 * Handle POST requests (some platforms use POST for callbacks)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  // Some platforms might use POST for callbacks
  // For now, redirect to GET handler
  return GET(request, { params });
}

/**
 * Get available platforms
 */
export function getAvailablePlatforms(): string[] {
  return Object.keys(providers);
}

/**
 * Check if platform is supported
 */
export function isPlatformSupported(platform: string): boolean {
  return platform.toLowerCase() in providers;
} 