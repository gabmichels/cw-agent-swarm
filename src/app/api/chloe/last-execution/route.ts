import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface SubGoal {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reasoning?: string;
  result?: string;
  timestamp?: string;
}

interface ExecutionTrace {
  step: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'success' | 'error' | 'info' | 'simulated';
  details?: any;
}

/**
 * API route to get the last execution data for Chloe's planning process
 * GET /api/chloe/last-execution
 */
export async function GET() {
  try {
    // Path to the execution logs directory
    const logsDir = path.join(process.cwd(), 'logs', 'executions');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      return NextResponse.json(
        { error: 'No execution logs found' },
        { status: 404 }
      );
    }
    
    // Get all log files and sort by date (newest first)
    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.json'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(logsDir, a));
        const statB = fs.statSync(path.join(logsDir, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });
    
    // If no files exist, return a 404
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No execution logs found' },
        { status: 404 }
      );
    }
    
    // Read the most recent log file
    const latestLog = fs.readFileSync(path.join(logsDir, files[0]), 'utf8');
    const executionData = JSON.parse(latestLog);
    
    // Process execution trace data to ensure it matches the expected frontend format
    if (executionData.executionTrace && Array.isArray(executionData.executionTrace)) {
      executionData.executionTrace = executionData.executionTrace.map((trace: any) => {
        // If it's a string (old format), convert to the new format
        if (typeof trace === 'string') {
          // Create a timestamp estimated from the file creation time
          const fileCreationTime = fs.statSync(path.join(logsDir, files[0])).mtime.getTime();
          const startTime = new Date().toISOString();
          const endTime = new Date().toISOString();
          
          return {
            step: trace,
            startTime,
            endTime,
            duration: 0,
            status: trace.toLowerCase().includes('error') ? 'error' : 
                   trace.toLowerCase().includes('completed') ? 'success' : 'info',
            details: { message: trace }
          };
        }
        
        // If it's already in the expected format, just ensure the date format is consistent
        return {
          ...trace,
          // Ensure timestamps are strings
          startTime: typeof trace.startTime === 'string' 
            ? trace.startTime 
            : new Date().toISOString(),
          
          endTime: trace.endTime 
            ? (typeof trace.endTime === 'string' 
              ? trace.endTime 
              : new Date().toISOString())
            : undefined
        };
      });
    }
    
    // Process subgoals to ensure timestamps
    if (executionData.task?.subGoals && Array.isArray(executionData.task.subGoals)) {
      executionData.task.subGoals = executionData.task.subGoals.map((subGoal: any) => {
        // If the subgoal doesn't have a timestamp, add one
        if (!subGoal.timestamp) {
          return {
            ...subGoal,
            timestamp: new Date().toISOString()
          };
        }
        return subGoal;
      });
    }
    
    return NextResponse.json(executionData);
  } catch (error) {
    console.error('Error fetching last execution:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve execution data' },
      { status: 500 }
    );
  }
} 