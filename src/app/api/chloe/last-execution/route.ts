import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface SubGoal {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reasoning?: string;
  result?: string;
  timestamp?: string;
}

interface ExecutionTrace {
  message: string;
  timestamp: string;
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
    
    // Add timestamps to execution trace items if they don't have them
    if (executionData.executionTrace && Array.isArray(executionData.executionTrace)) {
      executionData.executionTrace = executionData.executionTrace.map((trace: string | ExecutionTrace, index: number) => {
        if (typeof trace === 'string') {
          // Create a timestamp estimated from the file creation time
          // We're spacing them out by simulating 5-minute intervals
          const fileCreationTime = fs.statSync(path.join(logsDir, files[0])).mtime.getTime();
          const traceTime = new Date(fileCreationTime - (index * 5 * 60 * 1000));
          
          return {
            message: trace,
            timestamp: traceTime.toISOString()
          };
        }
        return trace;
      });
    }
    
    // Add timestamps to subgoals if they don't have them
    if (executionData.task?.subGoals && Array.isArray(executionData.task.subGoals)) {
      const totalSubGoals = executionData.task.subGoals.length;
      
      executionData.task.subGoals = executionData.task.subGoals.map((subGoal: SubGoal, index: number) => {
        if (!subGoal.timestamp) {
          // Create a timestamp estimated from the file creation time
          // We're spacing them out evenly from file creation time to current time
          const fileCreationTime = fs.statSync(path.join(logsDir, files[0])).mtime.getTime();
          const currentTime = Date.now();
          const timeRange = currentTime - fileCreationTime;
          
          // Calculate the time for this subgoal (more recent subgoals happened closer to current time)
          const subGoalTime = new Date(fileCreationTime + (timeRange * (index / totalSubGoals)));
          
          return {
            ...subGoal,
            timestamp: subGoalTime.toISOString()
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