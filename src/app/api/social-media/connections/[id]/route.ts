import { NextRequest, NextResponse } from 'next/server';
import { PrismaSocialMediaDatabase } from '../../../../../services/social-media/database/PrismaSocialMediaDatabase';
import { PrismaClient } from '@prisma/client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const prisma = new PrismaClient();
  const database = new PrismaSocialMediaDatabase(prisma);

  try {
    const connectionId = params.id;
    
    if (!connectionId) {
      return NextResponse.json({
        success: false,
        error: 'Connection ID is required'
      }, { status: 400 });
    }

    console.log('Deleting social media connection:', connectionId);

    // Check if connection exists
    const connection = await database.getConnection(connectionId);
    if (!connection) {
      return NextResponse.json({
        success: false,
        error: 'Connection not found'
      }, { status: 404 });
    }

    // Delete the connection
    await database.deleteConnection(connectionId);
    
    console.log('Successfully deleted connection:', connectionId);
    return NextResponse.json({
      success: true,
      message: 'Connection deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting social media connection:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete connection'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// GET method to retrieve individual connection details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const prisma = new PrismaClient();
  const database = new PrismaSocialMediaDatabase(prisma);

  try {
    const connectionId = params.id;
    
    if (!connectionId) {
      return NextResponse.json({
        success: false,
        error: 'Connection ID is required'
      }, { status: 400 });
    }

    const connection = await database.getConnection(connectionId);
    
    if (!connection) {
      return NextResponse.json({
        success: false,
        error: 'Connection not found'
      }, { status: 404 });
    }

    // Remove sensitive data before sending to client
    const sanitizedConnection = {
      id: connection.id,
      userId: connection.userId,
      organizationId: connection.organizationId,
      provider: connection.provider,
      providerAccountId: connection.providerAccountId,
      accountDisplayName: connection.accountDisplayName,
      accountUsername: connection.accountUsername,
      accountType: connection.accountType,
      encryptedCredentials: '[REDACTED]', // Never send credentials to client
      scopes: connection.scopes,
      connectionStatus: connection.connectionStatus,
      metadata: connection.metadata,
      lastValidated: connection.lastValidated,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt
    };

    return NextResponse.json({
      success: true,
      connection: sanitizedConnection
    });

  } catch (error) {
    console.error('Error fetching social media connection:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch connection'
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
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 