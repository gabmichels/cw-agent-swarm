import { NextRequest, NextResponse } from 'next/server';
import { MultiTenantTwitterProvider } from '@/services/social-media/providers/MultiTenantTwitterProvider';
import { MultiTenantLinkedInProvider } from '@/services/social-media/providers/MultiTenantLinkedInProvider';
import { MultiTenantTikTokProvider } from '@/services/social-media/providers/MultiTenantTikTokProvider';
import { MultiTenantFacebookProvider } from '@/services/social-media/providers/MultiTenantFacebookProvider';
import { MultiTenantInstagramProvider } from '@/services/social-media/providers/MultiTenantInstagramProvider';
import { IMultiTenantSocialMediaProvider } from '@/services/social-media/providers/base/MultiTenantProviderBase';

/**
 * Multi-Platform OAuth Connection Initiator
 * 
 * Initiates OAuth flows for all social media platforms
 * Route: POST /api/social-media/connect
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

interface ConnectRequest {
  platform: string;
  accountType?: 'personal' | 'company' | 'product' | 'creator' | 'business';
  tenantId: string;
  userId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConnectRequest = await request.json();
    
    // Validate request body
    if (!body.platform || !body.tenantId || !body.userId) {
      return NextResponse.json(
        { 
          error: 'Missing required fields', 
          required: ['platform', 'tenantId', 'userId'] 
        },
        { status: 400 }
      );
    }

    const { platform, accountType = 'personal', tenantId, userId } = body;

    // Get provider for platform
    const providerFactory = providers[platform.toLowerCase()];
    if (!providerFactory) {
      return NextResponse.json(
        { 
          error: 'Unsupported platform', 
          platform,
          supportedPlatforms: Object.keys(providers)
        },
        { status: 400 }
      );
    }

    const provider = providerFactory();

    // Validate account type for platform
    const supportedAccountTypes = provider.getSupportedAccountTypes();
    if (!supportedAccountTypes.includes(accountType)) {
      return NextResponse.json(
        {
          error: 'Unsupported account type for platform',
          platform,
          accountType,
          supportedAccountTypes
        },
        { status: 400 }
      );
    }

    console.log(`About to initiate OAuth for ${platform}:`, {
      platform,
      accountType,
      tenantId,
      userId
    });

    // Initiate OAuth flow
    const oauthData = await provider.initiateOAuth(tenantId, userId, accountType);

    console.log(`Initiated OAuth for ${platform}:`, {
      platform,
      accountType,
      tenantId,
      userId,
      state: oauthData.state
    });

    // OAuth state is now stored in database via PrismaStateStorage
    console.log('OAuth state stored in database for state:', oauthData.state);

    return NextResponse.json({
      success: true,
      platform,
      accountType,
      authUrl: oauthData.authUrl,
      state: oauthData.state,
      message: `OAuth flow initiated for ${platform}`
    });

  } catch (error) {
    console.error('OAuth initiation error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth flow',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * Get available platforms and their supported account types
 */
export async function GET() {
  try {
    const platformInfo: Record<string, {
      platform: string;
      supportedAccountTypes: string[];
    }> = {};

    for (const [platformName, providerFactory] of Object.entries(providers)) {
      const provider = providerFactory();
      platformInfo[platformName] = {
        platform: platformName,
        supportedAccountTypes: provider.getSupportedAccountTypes()
      };
    }

    return NextResponse.json({
      success: true,
      platforms: platformInfo,
      totalPlatforms: Object.keys(providers).length
    });

  } catch (error) {
    console.error('Error getting platform info:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get platform information',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * Validate connection request
 */
function validateConnectRequest(body: unknown): body is ConnectRequest {
  if (!body || typeof body !== 'object') return false;
  
  const req = body as Record<string, unknown>;
  
  return (
    typeof req.platform === 'string' &&
    typeof req.tenantId === 'string' &&
    typeof req.userId === 'string' &&
    (!req.accountType || typeof req.accountType === 'string')
  );
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 