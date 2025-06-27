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
    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Agent ID is required'
      }, { status: 400 });
    }

    const rawPermissions = await socialMediaService.getAgentPermissions(agentId);

    // Group permissions by connectionId and reconstruct the UI format
    const permissionsByConnection = new Map();

    for (const permission of rawPermissions) {
      if (!permissionsByConnection.has(permission.connectionId)) {
        permissionsByConnection.set(permission.connectionId, {
          connectionId: permission.connectionId,
          capabilities: {},
          restrictions: permission.restrictions
        });
      }

      const connectionData = permissionsByConnection.get(permission.connectionId);

      // Add each capability with its access level
      permission.capabilities.forEach(capability => {
        connectionData.capabilities[capability] = {
          enabled: true,
          accessLevel: permission.accessLevel,
          restrictions: permission.restrictions
        };
      });
    }

    // Convert map to array format expected by UI
    const permissions = Array.from(permissionsByConnection.values()).map(connectionData => ({
      ...connectionData,
      permissions: connectionData.capabilities
    }));

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
    const { agentId } = await params;
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

    // First, revoke all existing permissions for this agent to start fresh
    try {
      const existingPermissions = await socialMediaService.getAgentPermissions(agentId);
      for (const permission of existingPermissions) {
        await socialMediaDatabase.revokePermission(permission.id);
      }
    } catch (error) {
      console.error('Error revoking existing permissions:', error);
    }

    // Process each permission configuration
    const results = [];
    for (const permissionConfig of permissions) {
      const { connectionId, permissions: permissionsObj, restrictions } = permissionConfig;

      if (!connectionId || !permissionsObj) {
        continue; // Skip invalid entries
      }

      // Group capabilities by access level to minimize database calls
      const capabilitiesByAccessLevel = new Map<AccessLevel, SocialMediaCapability[]>();

      // Process the permissions object to extract enabled capabilities grouped by access level
      Object.entries(permissionsObj).forEach(([capability, permissionData]) => {
        if (permissionData && typeof permissionData === 'object' && 'enabled' in permissionData && permissionData.enabled) {
          const accessLevel = (permissionData as any).accessLevel || AccessLevel.READ;
          if (!capabilitiesByAccessLevel.has(accessLevel)) {
            capabilitiesByAccessLevel.set(accessLevel, []);
          }
          capabilitiesByAccessLevel.get(accessLevel)!.push(capability as SocialMediaCapability);
        }
      });

      // Create separate permission records for each access level
      for (const accessLevel of capabilitiesByAccessLevel.keys()) {
        const capabilities = capabilitiesByAccessLevel.get(accessLevel);
        if (!capabilities || capabilities.length === 0) continue;

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
          console.error(`Error granting ${accessLevel} permission for connection ${connectionId}:`, error);
          // Continue processing other permissions
        }
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