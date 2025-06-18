import { NextRequest, NextResponse } from 'next/server';
import { SocialMediaService } from '@/services/social-media/SocialMediaService';
import { PrismaSocialMediaDatabase } from '@/services/social-media/database/PrismaSocialMediaDatabase';
import { SocialMediaCapability, AccessLevel } from '@/services/social-media/database/ISocialMediaDatabase';
import { prisma } from '@/lib/prisma';

const socialMediaDatabase = new PrismaSocialMediaDatabase(prisma);
const socialMediaService = new SocialMediaService(socialMediaDatabase, new Map());

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = params;

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Agent ID is required'
      }, { status: 400 });
    }

    const permissions = await socialMediaService.getAgentPermissions(agentId);

    return NextResponse.json({
      success: true,
      permissions
    });

  } catch (error) {
    console.error('Error fetching agent social media permissions:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch permissions'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = params;
    const body = await request.json();
    const { permissions, grantedBy } = body;

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Agent ID is required'
      }, { status: 400 });
    }

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json({
        success: false,
        error: 'Permissions array is required'
      }, { status: 400 });
    }

    if (!grantedBy) {
      return NextResponse.json({
        success: false,
        error: 'grantedBy is required'
      }, { status: 400 });
    }

    // Process each permission
    const results = [];
    for (const permissionConfig of permissions) {
      const { connectionId, permissions: capabilities, accessLevel, restrictions } = permissionConfig;

      if (!connectionId || !capabilities || !accessLevel) {
        continue; // Skip invalid entries
      }

      try {
        const permission = await socialMediaService.grantAgentPermission(
          agentId,
          connectionId,
          capabilities,
          accessLevel,
          grantedBy,
          restrictions
        );
        results.push(permission);
      } catch (error) {
        console.error(`Error granting permission for connection ${connectionId}:`, error);
        // Continue processing other permissions
      }
    }

    return NextResponse.json({
      success: true,
      permissions: results
    });

  } catch (error) {
    console.error('Error saving agent social media permissions:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save permissions'
    }, { status: 500 });
  }
} 