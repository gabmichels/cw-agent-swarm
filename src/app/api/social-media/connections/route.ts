import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SocialMediaProvider, SocialMediaConnectionStatus, SocialMediaConnection } from '../../../../services/social-media/database/ISocialMediaDatabase';
import { PrismaSocialMediaDatabase } from '../../../../services/social-media/database/PrismaSocialMediaDatabase';
import { PrismaClient } from '@prisma/client';

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

export async function GET(request: NextRequest) {
  const prisma = new PrismaClient();
  const database = new PrismaSocialMediaDatabase(prisma);

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

    // Get connections from database
    let connections: SocialMediaConnection[];
    
    if (validatedQuery.organizationId) {
      connections = await database.getConnectionsByOrganization(validatedQuery.organizationId);
    } else if (validatedQuery.userId) {
      connections = await database.getConnectionsByUser(validatedQuery.userId);
    } else {
      // If neither userId nor organizationId is provided, return all connections
      // This is useful for development and testing
      const allConnections = await prisma.socialMediaConnection.findMany();
              connections = allConnections.map(conn => ({
          id: conn.id,
          userId: conn.userId || '',
          organizationId: conn.organizationId || '',
          provider: conn.provider as SocialMediaProvider,
          providerAccountId: conn.providerAccountId,
          accountDisplayName: conn.accountDisplayName,
          accountUsername: conn.accountUsername,
          accountType: conn.accountType as 'personal' | 'business' | 'creator',
          encryptedCredentials: conn.encryptedCredentials,
          scopes: conn.scopes.split(','),
          connectionStatus: conn.connectionStatus as SocialMediaConnectionStatus,
          metadata: conn.metadata ? JSON.parse(conn.metadata) : {},
          lastValidated: conn.lastValidated,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt
        }));
    }
    
    // Filter based on additional query parameters
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
      id: conn.id,
      userId: conn.userId,
      organizationId: conn.organizationId,
      provider: conn.provider,
      providerAccountId: conn.providerAccountId,
      accountDisplayName: conn.accountDisplayName,
      accountUsername: conn.accountUsername,
      accountType: conn.accountType,
      encryptedCredentials: '[REDACTED]', // Never send credentials to client
      scopes: conn.scopes,
      connectionStatus: conn.connectionStatus,
      metadata: conn.metadata,
      lastValidated: conn.lastValidated,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt
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
  } finally {
    await prisma.$disconnect();
  }
}

// POST method to create new connections (called by OAuth callback)
export async function POST(request: NextRequest) {
  const prisma = new PrismaClient();
  const database = new PrismaSocialMediaDatabase(prisma);

  try {
    const body = await request.json();
    
    console.log('Creating new social media connection:', body);
    
    // This endpoint could be used for manual connection creation
    // For now, connections are primarily created via OAuth callbacks
    
    return NextResponse.json({
      success: true,
      message: 'Connection creation via POST - implement as needed'
    });

  } catch (error) {
    console.error('Error creating social media connection:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create connection'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
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