import { NextRequest, NextResponse } from 'next/server';
import { SocialMediaToolApprovalService } from '@/services/approval/SocialMediaToolApprovalService';

const approvalService = new SocialMediaToolApprovalService();

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
      // Get specific social media tool approval setting
      const needsApproval = await approvalService.requiresApproval(agentId, toolName);
      return NextResponse.json({
        agentId,
        toolName,
        needsApproval
      });
    } else {
      // Get all social media approval settings for the agent
      const settings = await approvalService.getAgentApprovalSettings(agentId);
      return NextResponse.json({
        agentId,
        settings
      });
    }
  } catch (error) {
    console.error('Error fetching social media approval settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social media approval settings' },
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
    console.error('Error setting social media approval requirement:', error);
    return NextResponse.json(
      { error: 'Failed to set social media approval requirement' },
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
      message: 'Social media approval setting removed'
    });
  } catch (error) {
    console.error('Error removing social media approval setting:', error);
    return NextResponse.json(
      { error: 'Failed to remove social media approval setting' },
      { status: 500 }
    );
  }
} 