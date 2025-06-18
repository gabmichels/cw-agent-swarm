import { NextRequest, NextResponse } from 'next/server';
import { SocialMediaService } from '@/services/social-media/SocialMediaService';
import { PrismaSocialMediaDatabase } from '@/services/social-media/database/PrismaSocialMediaDatabase';
import { SocialMediaCapability, AccessLevel } from '@/services/social-media/database/ISocialMediaDatabase';
import { prisma } from '@/lib/prisma';

const socialMediaDatabase = new PrismaSocialMediaDatabase(prisma);
const socialMediaService = new SocialMediaService(socialMediaDatabase, new Map());

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

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
    console.error('Error fetching social media permissions:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch permissions'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      agentId, 
      connectionId, 
      capabilities, 
      accessLevel, 
      grantedBy,
      restrictions 
    } = body;

    if (!agentId || !connectionId || !capabilities || !accessLevel || !grantedBy) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, connectionId, capabilities, accessLevel, grantedBy'
      }, { status: 400 });
    }

    // Validate capabilities
    const validCapabilities = Object.values(SocialMediaCapability);
    const invalidCapabilities = capabilities.filter((cap: string) => !validCapabilities.includes(cap as SocialMediaCapability));
    
    if (invalidCapabilities.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Invalid capabilities: ${invalidCapabilities.join(', ')}`
      }, { status: 400 });
    }

    // Validate access level
    const validAccessLevels = Object.values(AccessLevel);
    if (!validAccessLevels.includes(accessLevel)) {
      return NextResponse.json({
        success: false,
        error: `Invalid access level: ${accessLevel}`
      }, { status: 400 });
    }

    const permission = await socialMediaService.grantAgentPermission(
      agentId,
      connectionId,
      capabilities,
      accessLevel,
      grantedBy,
      restrictions
    );

    return NextResponse.json({
      success: true,
      permission
    });

  } catch (error) {
    console.error('Error granting social media permission:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to grant permission'
    }, { status: 500 });
  }
} 