import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SocialMediaProvider, SocialMediaConnectionStatus } from '../../../../services/social-media/database/ISocialMediaDatabase';

// Following IMPLEMENTATION_GUIDELINES.md - strict typing with Zod validation
const ConnectionsQuerySchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  provider: z.nativeEnum(SocialMediaProvider).optional(),
  status: z.nativeEnum(SocialMediaConnectionStatus).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

type ConnectionsQuery = z.infer<typeof ConnectionsQuerySchema>;

// Mock data for now - replace with actual database calls
const mockConnections = [
  {
    id: 'conn_twitter_001',
    userId: 'user_001',
    organizationId: undefined,
    provider: SocialMediaProvider.TWITTER,
    providerAccountId: '123456789',
    accountDisplayName: 'John Doe',
    accountUsername: 'johndoe',
    accountType: 'personal' as const,
    encryptedCredentials: 'encrypted_token_data',
    scopes: ['tweet.read', 'tweet.write', 'users.read'],
    connectionStatus: SocialMediaConnectionStatus.ACTIVE,
    metadata: { 
      followerCount: 1250,
      verifiedStatus: false,
      accountCreated: '2020-01-15T00:00:00Z'
    },
    lastValidated: new Date('2024-01-01T12:00:00Z'),
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T12:00:00Z')
  },
  {
    id: 'conn_linkedin_001',
    userId: 'user_001',
    organizationId: undefined,
    provider: SocialMediaProvider.LINKEDIN,
    providerAccountId: 'linkedin_123',
    accountDisplayName: 'John Doe - Marketing Professional',
    accountUsername: 'john-doe-marketing',
    accountType: 'business' as const,
    encryptedCredentials: 'encrypted_linkedin_token',
    scopes: ['r_liteprofile', 'w_member_social'],
    connectionStatus: SocialMediaConnectionStatus.ACTIVE,
    metadata: { 
      connectionCount: 500,
      industry: 'Marketing',
      location: 'San Francisco, CA'
    },
    lastValidated: new Date('2024-01-01T11:30:00Z'),
    createdAt: new Date('2024-01-01T09:30:00Z'),
    updatedAt: new Date('2024-01-01T11:30:00Z')
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedQuery = ConnectionsQuerySchema.parse(queryParams);
    
    console.log('Fetching social media connections:', {
      userId: validatedQuery.userId,
      organizationId: validatedQuery.organizationId,
      provider: validatedQuery.provider,
      status: validatedQuery.status
    });

    // TODO: Replace with actual database implementation
    // const database = await getDatabaseInstance();
    // let connections;
    
    // if (validatedQuery.organizationId) {
    //   connections = await database.getConnectionsByOrganization(validatedQuery.organizationId);
    // } else if (validatedQuery.userId) {
    //   connections = await database.getConnectionsByUser(validatedQuery.userId);
    // } else {
    //   throw new Error('Either userId or organizationId must be provided');
    // }

    // Filter mock data based on query parameters
    let connections = mockConnections;
    
    if (validatedQuery.userId) {
      connections = connections.filter(conn => conn.userId === validatedQuery.userId);
    }
    
    if (validatedQuery.organizationId) {
      connections = connections.filter(conn => conn.organizationId === validatedQuery.organizationId);
    }
    
    if (validatedQuery.provider) {
      connections = connections.filter(conn => conn.provider === validatedQuery.provider);
    }
    
    if (validatedQuery.status) {
      connections = connections.filter(conn => conn.connectionStatus === validatedQuery.status);
    }

    // Apply pagination
    const paginatedConnections = connections.slice(
      validatedQuery.offset,
      validatedQuery.offset + validatedQuery.limit
    );

    // Remove sensitive data before sending to client
    const sanitizedConnections = paginatedConnections.map(conn => ({
      ...conn,
      encryptedCredentials: '[REDACTED]' // Never send credentials to client
    }));

    return NextResponse.json({
      success: true,
      connections: sanitizedConnections,
      pagination: {
        total: connections.length,
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
        hasMore: validatedQuery.offset + validatedQuery.limit < connections.length
      }
    });

  } catch (error) {
    console.error('Error fetching social media connections:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch connections'
    }, { status: 500 });
  }
}

// POST method to create new connections (called by OAuth callback)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // This would typically be called by the OAuth callback handler
    // to create a new connection after successful OAuth flow
    
    console.log('Creating new social media connection:', body);
    
    // TODO: Implement connection creation logic
    // - Validate OAuth tokens
    // - Encrypt and store credentials
    // - Create connection record
    // - Return connection details
    
    return NextResponse.json({
      success: true,
      message: 'Connection creation endpoint - to be implemented'
    });

  } catch (error) {
    console.error('Error creating social media connection:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create connection'
    }, { status: 500 });
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 