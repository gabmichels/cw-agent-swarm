import { NextRequest, NextResponse } from 'next/server';
import { ApprovalWorkflowService } from '@/services/ApprovalWorkflowService';
import { ChatApprovalHandler } from '@/services/ChatApprovalHandler';
import { approvalSchedulerIntegration } from '@/services/ApprovalSchedulerIntegration';

const approvalWorkflowService = new ApprovalWorkflowService();
const chatApprovalHandler = new ChatApprovalHandler();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    // Try to get real pending approvals from the scheduler integration
    let pendingApprovals;
    try {
      const realApprovals = await approvalSchedulerIntegration.getPendingApprovals(chatId);
      if (realApprovals.length > 0) {
        pendingApprovals = realApprovals.map(approval => ({
          id: approval.id,
          taskId: approval.taskId,
          type: approval.taskType,
          content: approval.draftContent || approval.taskDescription,
          priority: approval.priority,
          requestedAt: approval.requestedAt,
          scheduledTime: approval.scheduledTime,
          chatId: approval.chatId
        }));
      } else {
        // Fall back to mock data for demo
        pendingApprovals = [
          {
            id: 'task-1',
            taskId: 'task-1',
            type: 'tweet',
            content: '🚀 The future of AI agents is here! They\'re transforming how we work. #AIAgents #Future',
            priority: 'medium',
            requestedAt: new Date().toISOString(),
            chatId
          }
        ];
      }
    } catch (error) {
      console.error('Error fetching real approvals, using mock data:', error);
      // Fall back to mock data
      pendingApprovals = [
        {
          id: 'task-1',
          taskId: 'task-1',
          type: 'tweet',
          content: '🚀 The future of AI agents is here! They\'re transforming how we work. #AIAgents #Future',
          priority: 'medium',
          requestedAt: new Date().toISOString(),
          chatId
        }
      ];
    }

    return NextResponse.json({ 
      success: true,
      approvals: pendingApprovals 
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, decision, notes, chatId } = body;

    if (!taskId || !decision || !chatId) {
      return NextResponse.json({ 
        error: 'taskId, decision, and chatId are required' 
      }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ 
        error: 'decision must be "approved" or "rejected"' 
      }, { status: 400 });
    }

    // Process the approval decision through the integration service
    const approved = decision === 'approved';
    await approvalSchedulerIntegration.processApprovalDecision(
      taskId,
      approved,
      'demo-user',
      notes,
      chatId
    );

          return NextResponse.json({ 
        success: true,
        message: `Task ${decision}`,
        processed: true
      });
  } catch (error) {
    console.error('Error processing approval:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
} 