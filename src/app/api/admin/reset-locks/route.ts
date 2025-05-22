/**
 * API route to reset agent bootstrap locks
 * 
 * This endpoint allows administrators to reset stuck agent bootstrap locks.
 * It can be used to recover from situations where locks are stuck due to
 * server crashes or other errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetBootstrapLocks } from '../../../../server/agent/agent-bootstrap-utils';
import { logger } from '../../../../lib/logging';

/**
 * Handle POST requests to reset agent bootstrap locks
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { agentId } = body;
    
    // Reset locks
    const result = resetBootstrapLocks(agentId);
    
    // Log the action
    logger.info(`Reset agent bootstrap locks via API`, {
      agentId: agentId || 'all',
      result
    });
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: agentId 
        ? `Reset bootstrap lock for agent ${agentId}` 
        : 'Reset all bootstrap locks',
      resetCount: result.resetCount,
      agentIds: result.agentIds
    });
    
  } catch (error) {
    // Log error
    logger.error(`Error resetting bootstrap locks via API`, {
      error
    });
    
    // Return error response
    return NextResponse.json({
      success: false,
      message: 'Failed to reset bootstrap locks',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * GET handler for checking lock status
 */
export async function GET(request: NextRequest) {
  try {
    // Extract agent ID from query params if present
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    if (agentId) {
      // Return status for specific agent
      return NextResponse.json({
        message: 'Use POST method to reset locks'
      });
    } else {
      // Return general status message
      return NextResponse.json({
        message: 'Use POST method to reset locks'
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error checking lock status',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 