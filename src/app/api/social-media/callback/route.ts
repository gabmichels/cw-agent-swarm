import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ulid } from 'ulid';
import { SocialMediaProvider, SocialMediaConnectionStatus } from '../../../../services/social-media/database/ISocialMediaDatabase';
import { PrismaSocialMediaDatabase } from '../../../../services/social-media/database/PrismaSocialMediaDatabase';
import { PrismaClient } from '@prisma/client';

// Following IMPLEMENTATION_GUIDELINES.md - strict typing with Zod validation
const CallbackQuerySchema = z.object({
  provider: z.nativeEnum(SocialMediaProvider),
  code: z.string(),
  state: z.string(),
  error: z.string().optional(),
  error_description: z.string().optional()
});

type CallbackQuery = z.infer<typeof CallbackQuerySchema>;

// OAuth token exchange configurations
const getTokenConfig = (provider: SocialMediaProvider) => {
  switch (provider) {
    case SocialMediaProvider.TWITTER:
      return {
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        clientId: process.env.TWITTER_CLIENT_ID!,
        clientSecret: process.env.TWITTER_CLIENT_SECRET!,
        grantType: 'authorization_code'
      };

    case SocialMediaProvider.LINKEDIN:
      return {
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        clientId: process.env.LINKEDIN_CLIENT_ID!,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
        grantType: 'authorization_code'
      };

    case SocialMediaProvider.FACEBOOK:
      return {
        tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
        clientId: process.env.FACEBOOK_APP_ID!,
        clientSecret: process.env.FACEBOOK_APP_SECRET!,
        grantType: 'authorization_code'
      };

    case SocialMediaProvider.INSTAGRAM:
      return {
        tokenUrl: 'https://api.instagram.com/oauth/access_token',
        clientId: process.env.INSTAGRAM_CLIENT_ID!,
        clientSecret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grantType: 'authorization_code'
      };

    case SocialMediaProvider.REDDIT:
      return {
        tokenUrl: 'https://www.reddit.com/api/v1/access_token',
        clientId: process.env.REDDIT_CLIENT_ID!,
        clientSecret: process.env.REDDIT_CLIENT_SECRET!,
        grantType: 'authorization_code'
      };

    case SocialMediaProvider.TIKTOK:
      return {
        tokenUrl: 'https://open-api.tiktok.com/oauth/access_token/',
        clientId: process.env.TIKTOK_CLIENT_ID!,
        clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
        grantType: 'authorization_code'
      };

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

// Platform-specific user info endpoints
const getUserInfo = async (provider: SocialMediaProvider, accessToken: string) => {
  switch (provider) {
    case SocialMediaProvider.TWITTER:
      const twitterResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const twitterData = await twitterResponse.json();
      return {
        providerAccountId: twitterData.data?.id,
        displayName: twitterData.data?.name,
        username: twitterData.data?.username,
        accountType: 'personal' as const,
        metadata: {
          followerCount: twitterData.data?.public_metrics?.followers_count,
          verifiedStatus: twitterData.data?.verified
        }
      };

    case SocialMediaProvider.LINKEDIN:
      const linkedinResponse = await fetch('https://api.linkedin.com/v2/people/~', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const linkedinData = await linkedinResponse.json();
      return {
        providerAccountId: linkedinData.id,
        displayName: `${linkedinData.firstName?.localized?.en_US} ${linkedinData.lastName?.localized?.en_US}`,
        username: linkedinData.vanityName || linkedinData.id,
        accountType: 'business' as const,
        metadata: {
          industry: linkedinData.industry,
          location: linkedinData.location
        }
      };

    case SocialMediaProvider.FACEBOOK:
      const facebookResponse = await fetch('https://graph.facebook.com/me?fields=id,name,email', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const facebookData = await facebookResponse.json();
      return {
        providerAccountId: facebookData.id,
        displayName: facebookData.name,
        username: facebookData.email || facebookData.id,
        accountType: 'personal' as const,
        metadata: {
          email: facebookData.email
        }
      };

    case SocialMediaProvider.INSTAGRAM:
      const instagramResponse = await fetch('https://graph.instagram.com/me?fields=id,username,account_type', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const instagramData = await instagramResponse.json();
      return {
        providerAccountId: instagramData.id,
        displayName: instagramData.username,
        username: instagramData.username,
        accountType: instagramData.account_type?.toLowerCase() || 'personal' as const,
        metadata: {
          accountType: instagramData.account_type
        }
      };

    case SocialMediaProvider.REDDIT:
      const redditResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'AgentSwarm/1.0',
          'Content-Type': 'application/json'
        }
      });
      const redditData = await redditResponse.json();
      return {
        providerAccountId: redditData.id,
        displayName: redditData.name,
        username: redditData.name,
        accountType: 'personal' as const,
        metadata: {
          karma: redditData.total_karma,
          created: redditData.created_utc
        }
      };

    case SocialMediaProvider.TIKTOK:
      const tiktokResponse = await fetch('https://open-api.tiktok.com/user/info/', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const tiktokData = await tiktokResponse.json();
      return {
        providerAccountId: tiktokData.data?.user?.open_id,
        displayName: tiktokData.data?.user?.display_name,
        username: tiktokData.data?.user?.username,
        accountType: 'creator' as const,
        metadata: {
          followerCount: tiktokData.data?.user?.follower_count,
          videoCount: tiktokData.data?.user?.video_count
        }
      };

    default:
      throw new Error(`User info not implemented for provider: ${provider}`);
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    console.log('OAuth callback received:', queryParams);

    // Check for OAuth errors first
    if (queryParams.error) {
      console.error('OAuth error:', queryParams.error, queryParams.error_description);
      
      // Redirect to frontend with error
      const errorUrl = new URL('/agents', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
      errorUrl.searchParams.set('social_media_error', queryParams.error);
      errorUrl.searchParams.set('error_description', queryParams.error_description || 'OAuth authorization failed');
      
      return NextResponse.redirect(errorUrl.toString());
    }

    const validatedQuery = CallbackQuerySchema.parse(queryParams);
    
    // Decode and validate state parameter
    let stateData;
    try {
      const decodedState = Buffer.from(validatedQuery.state, 'base64').toString('utf-8');
      stateData = JSON.parse(decodedState);
      
      // Validate state timestamp (prevent replay attacks)
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 10 * 60 * 1000) { // 10 minutes
        throw new Error('State parameter expired');
      }
    } catch (error) {
      console.error('Invalid state parameter:', error);
      throw new Error('Invalid or expired state parameter');
    }

    console.log('Processing OAuth callback for:', {
      provider: validatedQuery.provider,
      userId: stateData.userId,
      organizationId: stateData.organizationId
    });

    // Exchange authorization code for access token
    const tokenConfig = getTokenConfig(validatedQuery.provider);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/social-media/callback?provider=${validatedQuery.provider}`;

    const tokenParams = new URLSearchParams({
      grant_type: tokenConfig.grantType,
      client_id: tokenConfig.clientId,
      client_secret: tokenConfig.clientSecret,
      code: validatedQuery.code,
      redirect_uri: redirectUri
    });

    console.log(`Exchanging code for token with ${validatedQuery.provider}...`);

    const tokenResponse = await fetch(tokenConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful for', validatedQuery.provider);

    // Get user information from the platform
    const userInfo = await getUserInfo(validatedQuery.provider, tokenData.access_token);
    console.log('User info retrieved:', userInfo);

    // Store the connection in database
    const prisma = new PrismaClient();
    const database = new PrismaSocialMediaDatabase(prisma);

    const connection = await database.createConnection({
      userId: stateData.userId,
      organizationId: stateData.organizationId,
      provider: validatedQuery.provider,
      providerAccountId: userInfo.providerAccountId,
      accountDisplayName: userInfo.displayName,
      accountUsername: userInfo.username,
      accountType: userInfo.accountType,
      encryptedCredentials: JSON.stringify({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
        tokenType: tokenData.token_type || 'Bearer',
        scopes: tokenData.scope?.split(' ') || []
      }),
      scopes: tokenData.scope?.split(' ') || [],
      connectionStatus: SocialMediaConnectionStatus.ACTIVE,
      metadata: userInfo.metadata,
      lastValidated: new Date()
    });

    console.log('Social media connection created:', connection.id);

    // Log the successful connection
    await database.logAction({
      timestamp: new Date(),
      connectionId: connection.id,
      agentId: 'system',
      action: 'authenticate',
      platform: validatedQuery.provider,
      result: 'success',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        accountType: userInfo.accountType,
        scopes: tokenData.scope?.split(' ') || []
      }
    });

    // Redirect to success page
    const successUrl = new URL(stateData.returnUrl || '/agents', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    successUrl.searchParams.set('social_media_connected', validatedQuery.provider);
    successUrl.searchParams.set('account_name', userInfo.displayName);
    
    return NextResponse.redirect(successUrl.toString());

  } catch (error) {
    console.error('OAuth callback error:', error);
    
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
    }

    // Redirect to frontend with error
    const errorUrl = new URL('/agents', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    errorUrl.searchParams.set('social_media_error', 'callback_failed');
    errorUrl.searchParams.set('error_description', error instanceof Error ? error.message : 'OAuth callback failed');
    
    return NextResponse.redirect(errorUrl.toString());
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 