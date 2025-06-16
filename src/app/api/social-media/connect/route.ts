import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { z } from 'zod';
import { SocialMediaProvider } from '../../../../services/social-media/database/ISocialMediaDatabase';
import { getSocialMediaScopes } from '../../../../services/social-media/scopes/SocialMediaScopes';

// Following IMPLEMENTATION_GUIDELINES.md - strict typing with Zod validation
const ConnectRequestSchema = z.object({
  provider: z.nativeEnum(SocialMediaProvider),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  returnUrl: z.string().url().optional()
});

type ConnectRequest = z.infer<typeof ConnectRequestSchema>;

// OAuth configuration for each provider
const getOAuthConfig = (provider: SocialMediaProvider) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/api/social-media/callback`;

  switch (provider) {
    case SocialMediaProvider.TWITTER:
      return {
        clientId: process.env.TWITTER_CLIENT_ID!,
        clientSecret: process.env.TWITTER_CLIENT_SECRET!,
        authUrl: 'https://twitter.com/i/oauth2/authorize',
        redirectUri: `${callbackUrl}?provider=twitter`,
        scopes: getSocialMediaScopes(provider)
      };

    case SocialMediaProvider.LINKEDIN:
      return {
        clientId: process.env.LINKEDIN_CLIENT_ID!,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        redirectUri: `${callbackUrl}?provider=linkedin`,
        scopes: getSocialMediaScopes(provider)
      };

    case SocialMediaProvider.FACEBOOK:
      return {
        clientId: process.env.FACEBOOK_APP_ID!,
        clientSecret: process.env.FACEBOOK_APP_SECRET!,
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        redirectUri: `${callbackUrl}?provider=facebook`,
        scopes: getSocialMediaScopes(provider)
      };

    case SocialMediaProvider.INSTAGRAM:
      return {
        clientId: process.env.INSTAGRAM_CLIENT_ID!,
        clientSecret: process.env.INSTAGRAM_CLIENT_SECRET!,
        authUrl: 'https://api.instagram.com/oauth/authorize',
        redirectUri: `${callbackUrl}?provider=instagram`,
        scopes: getSocialMediaScopes(provider)
      };

    case SocialMediaProvider.REDDIT:
      return {
        clientId: process.env.REDDIT_CLIENT_ID!,
        clientSecret: process.env.REDDIT_CLIENT_SECRET!,
        authUrl: 'https://www.reddit.com/api/v1/authorize',
        redirectUri: `${callbackUrl}?provider=reddit`,
        scopes: getSocialMediaScopes(provider)
      };

    case SocialMediaProvider.TIKTOK:
      return {
        clientId: process.env.TIKTOK_CLIENT_ID!,
        clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
        authUrl: 'https://www.tiktok.com/auth/authorize/',
        redirectUri: `${callbackUrl}?provider=tiktok`,
        scopes: getSocialMediaScopes(provider)
      };

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ConnectRequestSchema.parse(body);
    
    console.log('Social media connect request:', {
      provider: validatedData.provider,
      userId: validatedData.userId,
      organizationId: validatedData.organizationId
    });

    // Get OAuth configuration for the provider
    const oauthConfig = getOAuthConfig(validatedData.provider);
    
    // Generate state parameter for security (CSRF protection)
    const state = ulid();
    const stateData = {
      provider: validatedData.provider,
      userId: validatedData.userId,
      organizationId: validatedData.organizationId,
      returnUrl: validatedData.returnUrl,
      timestamp: Date.now()
    };

    // Store state in session/cache (implement based on your session management)
    // For now, we'll encode it in the state parameter (in production, use Redis/session store)
    const encodedState = Buffer.from(JSON.stringify({ state, ...stateData })).toString('base64');

    // Build authorization URL
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: oauthConfig.clientId,
      redirect_uri: oauthConfig.redirectUri,
      scope: (validatedData.scopes || oauthConfig.scopes).join(' '),
      state: encodedState,
      // Provider-specific parameters
      ...(validatedData.provider === SocialMediaProvider.TWITTER && {
        code_challenge: 'challenge', // PKCE - implement proper PKCE for production
        code_challenge_method: 'S256'
      }),
      ...(validatedData.provider === SocialMediaProvider.LINKEDIN && {
        access_type: 'offline'
      }),
      ...(validatedData.provider === SocialMediaProvider.REDDIT && {
        duration: 'permanent'
      })
    });

    const authUrl = `${oauthConfig.authUrl}?${authParams.toString()}`;

    console.log(`Generated ${validatedData.provider} OAuth URL:`, authUrl);

    return NextResponse.json({
      success: true,
      authUrl,
      provider: validatedData.provider,
      state: encodedState
    });

  } catch (error) {
    console.error('Error initiating social media connection:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate connection'
    }, { status: 500 });
  }
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