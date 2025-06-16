import { NextRequest, NextResponse } from 'next/server';
import { MultiTenantTwitterProvider } from '@/services/social-media/providers/MultiTenantTwitterProvider';
import { MultiTenantLinkedInProvider } from '@/services/social-media/providers/MultiTenantLinkedInProvider';
import { MultiTenantTikTokProvider } from '@/services/social-media/providers/MultiTenantTikTokProvider';
import { MultiTenantFacebookProvider } from '@/services/social-media/providers/MultiTenantFacebookProvider';
import { MultiTenantInstagramProvider } from '@/services/social-media/providers/MultiTenantInstagramProvider';
import { SocialMediaProvider } from '@/services/social-media/database/ISocialMediaDatabase';
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
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(error)}&platform=${platform}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=missing_parameters&platform=${platform}`
      );
    }

    // Get provider for platform
    const providerFactory = providers[platform.toLowerCase()];
    if (!providerFactory) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=unsupported_platform&platform=${platform}`
      );
    }

    const provider = providerFactory();

    // TODO: Extract tenantId and userId from state or session
    // For now, using placeholder values - in production, these would come from:
    // 1. Decoded state parameter (recommended)
    // 2. User session/JWT token
    // 3. Database lookup
    const tenantId = 'tenant_placeholder'; // Extract from state or session
    const userId = 'user_placeholder'; // Extract from state or session

    // Handle OAuth callback
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

    // TODO: Store token in database
    // In production, you would:
    // 1. Save tokenData to your database
    // 2. Associate with the user/tenant
    // 3. Set up proper error handling and rollback

    // Redirect back to settings with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?success=true&platform=${platform}&account=${encodeURIComponent(tokenData.accountDisplayName)}`
    );

  } catch (error) {
    console.error(`OAuth callback error for ${params.platform}:`, error);
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=callback_failed&platform=${params.platform}&details=${encodeURIComponent((error as Error).message)}`
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