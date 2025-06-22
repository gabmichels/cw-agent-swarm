import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';
import { z } from 'zod';

const prisma = new PrismaClient();

// Request validation schemas
const CreateApiKeySchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  displayName: z.string().min(1, 'Display name is required'),
  apiKey: z.string().min(1, 'API key is required'),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
});

const UpdateApiKeySchema = z.object({
  id: z.string().min(1, 'Connection ID is required'),
  displayName: z.string().min(1, 'Display name is required'),
  apiKey: z.string().min(1, 'API key is required'),
});

// Simple encryption/decryption (in production, use proper encryption)
function encryptApiKey(apiKey: string): string {
  // In production, use proper encryption like AES-256
  // For now, just base64 encode (NOT secure for production)
  return Buffer.from(apiKey).toString('base64');
}

function decryptApiKey(encryptedKey: string): string {
  // In production, use proper decryption
  // For now, just base64 decode
  return Buffer.from(encryptedKey, 'base64').toString();
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '*'.repeat(apiKey.length);
  }
  return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
}

// GET - Retrieve user's API key connections
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const organizationId = url.searchParams.get('organizationId');

    if (!userId && !organizationId) {
      return NextResponse.json(
        { error: 'Either userId or organizationId is required' },
        { status: 400 }
      );
    }

    // Find integration connections
    const connections = await prisma.integrationConnection.findMany({
      where: {
        OR: [
          userId ? { userId } : {},
          organizationId ? { organizationId } : {},
        ],
      },
      include: {
        provider: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform to API response format
    const apiKeyConnections = connections.map((conn) => ({
      id: conn.id,
      provider: conn.provider.name,
      displayName: conn.displayName || conn.provider.displayName,
      apiKey: conn.apiKey ? maskApiKey(decryptApiKey(conn.apiKey)) : '',
      status: conn.status === 'ACTIVE' ? 'ACTIVE' : 'INVALID',
      lastValidated: conn.lastValidated,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }));

    return NextResponse.json({ connections: apiKeyConnections });
  } catch (error) {
    console.error('Error fetching API key connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API key connections' },
      { status: 500 }
    );
  }
}

// POST - Create new API key connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateApiKeySchema.parse(body);

    // Find or create the integration provider
    let provider = await prisma.integrationProvider.findUnique({
      where: { name: validatedData.provider },
    });

    if (!provider) {
      // Create the provider if it doesn't exist
      provider = await prisma.integrationProvider.create({
        data: {
          id: ulid(),
          name: validatedData.provider,
          displayName: validatedData.displayName,
          category: 'API_INTEGRATION',
          type: 'API_KEY',
          description: `${validatedData.displayName} API integration`,
          isActive: true,
          requiresUserAuth: true,
          apiKeyName: 'API Key',
        },
      });
    }

    // Check if connection already exists
    const existingConnection = await prisma.integrationConnection.findFirst({
      where: {
        providerId: provider.id,
        OR: [
          validatedData.userId ? { userId: validatedData.userId } : {},
          validatedData.organizationId ? { organizationId: validatedData.organizationId } : {},
        ],
      },
    });

    if (existingConnection) {
      // Update existing connection
      const updatedConnection = await prisma.integrationConnection.update({
        where: { id: existingConnection.id },
        data: {
          displayName: validatedData.displayName,
          apiKey: encryptApiKey(validatedData.apiKey),
          status: 'ACTIVE',
          lastValidated: new Date(),
          updatedAt: new Date(),
        },
        include: {
          provider: true,
        },
      });

      return NextResponse.json({
        success: true,
        connection: {
          id: updatedConnection.id,
          provider: updatedConnection.provider.name,
          displayName: updatedConnection.displayName,
          apiKey: maskApiKey(validatedData.apiKey),
          status: 'ACTIVE',
          lastValidated: updatedConnection.lastValidated,
          createdAt: updatedConnection.createdAt,
          updatedAt: updatedConnection.updatedAt,
        },
      });
    } else {
      // Create new connection
      const newConnection = await prisma.integrationConnection.create({
        data: {
          id: ulid(),
          providerId: provider.id,
          userId: validatedData.userId,
          organizationId: validatedData.organizationId,
          displayName: validatedData.displayName,
          apiKey: encryptApiKey(validatedData.apiKey),
          status: 'ACTIVE',
          lastValidated: new Date(),
        },
        include: {
          provider: true,
        },
      });

      return NextResponse.json({
        success: true,
        connection: {
          id: newConnection.id,
          provider: newConnection.provider.name,
          displayName: newConnection.displayName,
          apiKey: maskApiKey(validatedData.apiKey),
          status: 'ACTIVE',
          lastValidated: newConnection.lastValidated,
          createdAt: newConnection.createdAt,
          updatedAt: newConnection.updatedAt,
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating API key connection:', error);
    return NextResponse.json(
      { error: 'Failed to create API key connection' },
      { status: 500 }
    );
  }
}

// PUT - Update existing API key connection
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = UpdateApiKeySchema.parse(body);

    const updatedConnection = await prisma.integrationConnection.update({
      where: { id: validatedData.id },
      data: {
        displayName: validatedData.displayName,
        apiKey: encryptApiKey(validatedData.apiKey),
        status: 'ACTIVE',
        lastValidated: new Date(),
        updatedAt: new Date(),
      },
      include: {
        provider: true,
      },
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: updatedConnection.id,
        provider: updatedConnection.provider.name,
        displayName: updatedConnection.displayName,
        apiKey: maskApiKey(validatedData.apiKey),
        status: 'ACTIVE',
        lastValidated: updatedConnection.lastValidated,
        createdAt: updatedConnection.createdAt,
        updatedAt: updatedConnection.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating API key connection:', error);
    return NextResponse.json(
      { error: 'Failed to update API key connection' },
      { status: 500 }
    );
  }
}

// DELETE - Remove API key connection
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const connectionId = url.searchParams.get('id');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    await prisma.integrationConnection.delete({
      where: { id: connectionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key connection' },
      { status: 500 }
    );
  }
} 