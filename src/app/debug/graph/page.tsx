'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SubGoal {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reasoning?: string;
  result?: string;
  timestamp?: string;
}

interface PlanningTask {
  goal: string;
  subGoals: SubGoal[];
  reasoning: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

interface ExecutionTrace {
  step: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'success' | 'error' | 'info' | 'simulated';
  details?: any;
}

interface PlanningState {
  goal: string;
  task?: PlanningTask;
  executionTrace: ExecutionTrace[];
  finalResult?: string;
  error?: string;
}

export default function GraphDebugPage() {
  const [planningState, setPlanningState] = useState<PlanningState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchLastExecution() {
      try {
        // Fetch the most recent execution from an API endpoint
        const response = await fetch('/api/chloe/last-execution');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch execution data: ${response.statusText}`);
        }
        
        const data = await response.json();
        setPlanningState(data);
      } catch (err) {
        console.error('Error fetching plan execution data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        
        // For testing/demo purposes, use sample data if API fails
        setPlanningState(getSamplePlanningState());
      } finally {
        setLoading(false);
      }
    }
    
    fetchLastExecution();
  }, []);

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Helper function to get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-500 text-green-800';
      case 'failed':
        return 'bg-red-100 border-red-500 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 border-blue-500 text-blue-800';
      case 'pending':
        return 'bg-gray-100 border-gray-500 text-gray-800';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !planningState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-md">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
        <button 
          onClick={() => router.push('/')}
          className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Chloe's Execution Graph</h1>
      
      {planningState && (
        <div className="space-y-8">
          {/* Goal Section */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl text-white font-semibold mb-2">Goal</h2>
            <p className="text-gray-300">{planningState.goal}</p>
          </div>
          
          {/* Planning Status */}
          {planningState.task && (
            <div className="bg-gray-100 p-4 rounded-lg border-l-4 border-blue-500">
              <h2 className="text-lg font-semibold">Plan Status: <span className="font-normal">{planningState.task.status}</span></h2>
              <div className="mt-2">
                <h3 className="font-medium">Reasoning</h3>
                <p className="text-gray-700">{planningState.task.reasoning}</p>
              </div>
            </div>
          )}
          
          {/* Sub-goals/Steps Section */}
          {planningState.task?.subGoals && planningState.task.subGoals.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Execution Steps</h2>
              <div className="space-y-4">
                {planningState.task.subGoals.map((subGoal, index) => (
                  <div 
                    key={subGoal.id}
                    className={`p-4 rounded-lg border-l-4 ${getStatusColor(subGoal.status)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">Step {index + 1}: {subGoal.description}</h3>
                        <div className="text-sm text-gray-500">Status: {subGoal.status}</div>
                        {subGoal.timestamp && (
                          <div className="text-sm text-gray-500">Time: {formatTimestamp(subGoal.timestamp)}</div>
                        )}
                      </div>
                      <div className="px-2 py-1 rounded-full text-xs font-semibold">
                        {subGoal.status === 'completed' ? '✓' : subGoal.status === 'failed' ? '✗' : '●'}
                      </div>
                    </div>
                    
                    {subGoal.reasoning && (
                      <div className="mt-2">
                        <h4 className="text-sm font-medium">Reasoning</h4>
                        <p className="text-gray-700 text-sm">{subGoal.reasoning}</p>
                      </div>
                    )}
                    
                    {subGoal.result && (
                      <div className="mt-2">
                        <h4 className="text-sm font-medium">Result</h4>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{subGoal.result}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Execution Trace */}
          {planningState.executionTrace && planningState.executionTrace.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Execution Trace</h2>
              <div className="bg-gray-900 text-gray-300 p-4 rounded-lg overflow-auto max-h-96">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-700">
                      <th className="pb-2 pr-4">Step</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Start Time</th>
                      <th className="pb-2 pr-4">End Time</th>
                      <th className="pb-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planningState.executionTrace.map((trace, index) => {
                      // Get status color
                      let statusColor = '';
                      switch(trace.status) {
                        case 'success': statusColor = 'text-green-400'; break;
                        case 'error': statusColor = 'text-red-400'; break;
                        case 'info': statusColor = 'text-blue-400'; break;
                        case 'simulated': statusColor = 'text-yellow-400'; break;
                        default: statusColor = 'text-gray-400';
                      }
                      
                      return (
                        <tr key={index} className="border-b border-gray-800 hover:bg-gray-800">
                          <td className="py-2 pr-4">{trace.step}</td>
                          <td className={`py-2 pr-4 ${statusColor}`}>{trace.status}</td>
                          <td className="py-2 pr-4">{formatTimestamp(trace.startTime)}</td>
                          <td className="py-2 pr-4">{trace.endTime ? formatTimestamp(trace.endTime) : '-'}</td>
                          <td className="py-2">
                            {trace.duration !== undefined ? `${(trace.duration / 1000).toFixed(2)}s` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Final Result */}
          {planningState.finalResult && (
            <div className="bg-green-100 p-4 rounded-lg border-l-4 border-green-500">
              <h2 className="text-xl font-semibold mb-2">Final Result</h2>
              <p className="text-gray-800 whitespace-pre-wrap">{planningState.finalResult}</p>
            </div>
          )}
          
          {/* Error (if any) */}
          {planningState.error && (
            <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500">
              <h2 className="text-xl font-semibold mb-2">Error</h2>
              <p className="text-red-800">{planningState.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sample data for testing/demo purposes
function getSamplePlanningState(): PlanningState {
  return {
    goal: "Create a marketing campaign for our new fitness product",
    task: {
      goal: "Create a marketing campaign for our new fitness product",
      subGoals: [
        {
          id: "sg-1",
          description: "Analyze target audience demographics",
          status: "completed",
          reasoning: "Need to understand who would be most interested in this product",
          result: "Analysis shows that young adults (25-34) who are health-conscious but time-constrained are the primary target audience.",
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: "sg-2",
          description: "Develop key messaging and unique selling points",
          status: "completed",
          reasoning: "Need to craft a compelling value proposition",
          result: "Key message: 'Fit in your fitness, anytime, anywhere' with USPs focusing on convenience, effectiveness, and community support.",
          timestamp: new Date(Date.now() - 2400000).toISOString()
        },
        {
          id: "sg-3",
          description: "Outline social media campaign strategy",
          status: "completed",
          reasoning: "Social media is a key channel for reaching the target audience",
          result: "Strategy includes Instagram and TikTok as primary platforms with influencer partnerships and user-generated content contests.",
          timestamp: new Date(Date.now() - 1200000).toISOString()
        },
        {
          id: "sg-4",
          description: "Create sample content and ad mockups",
          status: "failed",
          reasoning: "Visual content is crucial for engagement",
          result: "Failed: Unable to create visual mockups due to lack of design tools integration.",
          timestamp: new Date(Date.now() - 600000).toISOString()
        },
        {
          id: "sg-5",
          description: "Develop budget allocation and ROI metrics",
          status: "completed",
          reasoning: "Need to ensure campaign is cost-effective",
          result: "Budget proposal: 40% on paid social, 30% on influencer partnerships, 20% on content creation, 10% on analytics tools.",
          timestamp: new Date(Date.now() - 300000).toISOString()
        }
      ],
      reasoning: "This plan provides a comprehensive approach to launching a marketing campaign for the new fitness product, covering audience analysis, messaging, channel strategy, content, and budget considerations.",
      status: "completed"
    },
    executionTrace: [
      {
        step: "Analyze target audience demographics",
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date(Date.now() - 3600000).toISOString(),
        duration: 0,
        status: "success",
        details: {
          result: "Analysis shows that young adults (25-34) who are health-conscious but time-constrained are the primary target audience."
        }
      },
      {
        step: "Develop key messaging and unique selling points",
        startTime: new Date(Date.now() - 2400000).toISOString(),
        endTime: new Date(Date.now() - 2400000).toISOString(),
        duration: 0,
        status: "success",
        details: {
          result: "Key message: 'Fit in your fitness, anytime, anywhere' with USPs focusing on convenience, effectiveness, and community support."
        }
      },
      {
        step: "Outline social media campaign strategy",
        startTime: new Date(Date.now() - 1200000).toISOString(),
        endTime: new Date(Date.now() - 1200000).toISOString(),
        duration: 0,
        status: "success",
        details: {
          result: "Strategy includes Instagram and TikTok as primary platforms with influencer partnerships and user-generated content contests."
        }
      },
      {
        step: "Create sample content and ad mockups",
        startTime: new Date(Date.now() - 600000).toISOString(),
        endTime: new Date(Date.now() - 600000).toISOString(),
        duration: 0,
        status: "error",
        details: {
          error: "Failed: Unable to create visual mockups due to lack of design tools integration."
        }
      },
      {
        step: "Develop budget allocation and ROI metrics",
        startTime: new Date(Date.now() - 300000).toISOString(),
        endTime: new Date(Date.now() - 300000).toISOString(),
        duration: 0,
        status: "success",
        details: {
          result: "Budget proposal: 40% on paid social, 30% on influencer partnerships, 20% on content creation, 10% on analytics tools."
        }
      }
    ],
    finalResult: "Marketing Campaign Plan for New Fitness Product\n\nTarget Audience: Young adults (25-34) who are health-conscious but time-constrained\n\nKey Message: 'Fit in your fitness, anytime, anywhere'\n\nChannels: Primary focus on Instagram and TikTok with influencer partnerships\n\nBudget Allocation: 40% on paid social, 30% on influencer partnerships, 20% on content creation, 10% on analytics tools\n\nLimitations: Unable to create visual mockups due to tool limitations. Recommend working with design team for visual content creation."
  };
} 