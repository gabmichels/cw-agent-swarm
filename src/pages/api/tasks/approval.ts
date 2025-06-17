/**
 * API endpoints for task approval management
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { approvalWorkflowService } from '../../../services/ApprovalWorkflowService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      // Handle approval decision
      const { taskId, approved, userId, notes } = req.body;
      
      if (!taskId || typeof approved !== 'boolean' || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: taskId, approved, userId'
        });
      }
      
      await approvalWorkflowService.handleApprovalDecision({
        taskId,
        approved,
        userId,
        notes
      });
      
      return res.status(200).json({
        success: true,
        message: approved ? 'Task approved successfully' : 'Task rejected successfully'
      });
      
    } else if (req.method === 'GET') {
      // Get pending approvals for a chat
      const { chatId } = req.query;
      
      if (!chatId || typeof chatId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: chatId'
        });
      }
      
      const pendingApprovals = await approvalWorkflowService.getPendingApprovals(chatId);
      
      return res.status(200).json({
        success: true,
        approvals: pendingApprovals
      });
      
    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }
    
  } catch (error) {
    console.error('Error in approval API:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
} 