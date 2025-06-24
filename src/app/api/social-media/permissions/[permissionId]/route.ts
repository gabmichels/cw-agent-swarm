import { NextRequest, NextResponse } from 'next/server';
import { SocialMediaService } from '@/services/social-media/SocialMediaService';
import { PrismaSocialMediaDatabase } from '@/services/social-media/database/PrismaSocialMediaDatabase';
import { prisma } from '@/lib/prisma';

const socialMediaDatabase = new PrismaSocialMediaDatabase(prisma);
const socialMediaService = new SocialMediaService(socialMediaDatabase, new Map());

export async function DELETE(
  request: NextRequest,
  { params }: { params: { permissionId: string } }
) {
  try {
    const { permissionId  } = await params;

    if (!permissionId) {
      return NextResponse.json({
        success: false,
        error: 'Permission ID is required'
      }, { status: 400 });
    }

    // Revoke the permission by setting isActive to false
    await socialMediaDatabase.revokePermission(permissionId);

    return NextResponse.json({
      success: true,
      message: 'Permission revoked successfully'
    });

  } catch (error) {
    console.error('Error revoking social media permission:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke permission'
    }, { status: 500 });
  }
} 