import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/services/database/DatabaseService';
import { WorkspaceToolApprovalService } from '@/services/approval/WorkspaceToolApprovalService';

const databaseService = new DatabaseService();
const approvalService = new WorkspaceToolApprovalService(databaseService);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const toolName = searchParams.get('toolName');

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId parameter is required' },
        { status: 400 }
      );
    }

    if (toolName) {
      // Get specific tool approval setting
      const needsApproval = await approvalService.requiresApproval(agentId, toolName);
      return NextResponse.json({
        agentId,
        toolName,
        needsApproval
      });
    } else {
      // Get all approval settings for the agent
      const settings = await approvalService.getAgentApprovalSettings(agentId);
      return NextResponse.json({
        agentId,
        settings
      });
    }
  } catch (error) {
    console.error('Error fetching approval settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, toolName, needsApproval, grantedBy } = body;

    if (!agentId || !toolName || typeof needsApproval !== 'boolean') {
      return NextResponse.json(
        { error: 'agentId, toolName, and needsApproval are required' },
        { status: 400 }
      );
    }

    const setting = await approvalService.setApprovalRequirement(
      agentId,
      toolName,
      needsApproval,
      grantedBy
    );

    return NextResponse.json({
      success: true,
      setting
    });
  } catch (error) {
    console.error('Error setting approval requirement:', error);
    return NextResponse.json(
      { error: 'Failed to set approval requirement' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const toolName = searchParams.get('toolName');

    if (!agentId || !toolName) {
      return NextResponse.json(
        { error: 'agentId and toolName parameters are required' },
        { status: 400 }
      );
    }

    await approvalService.removeApprovalSetting(agentId, toolName);

    return NextResponse.json({
      success: true,
      message: 'Approval setting removed'
    });
  } catch (error) {
    console.error('Error removing approval setting:', error);
    return NextResponse.json(
      { error: 'Failed to remove approval setting' },
      { status: 500 }
    );
  }
} 