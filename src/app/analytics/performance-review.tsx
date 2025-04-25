'use client';

import { useState } from 'react';

interface PerformanceMetrics {
  intentSuccessRate: number;
  taskCompletionRate: number;
  averageResponseTime: number;
  userSatisfactionScore: number;
  knowledgeUtilizationRate: number;
  memoryRetrievalAccuracy: number;
  updatedAt: string;
}

export default function PerformanceReview() {
  const [loading, setLoading] = useState(false);
  const [reviewType, setReviewType] = useState('daily');
  const [result, setResult] = useState<{
    success: boolean;
    metrics?: PerformanceMetrics;
    error?: string;
  } | null>(null);

  const runPerformanceReview = async () => {
    try {
      setLoading(true);
      setResult(null);

      const response = await fetch('/api/performance-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewType }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error running performance review:', error);
      setResult({
        success: false,
        error: 'Failed to run performance review. See console for details.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Performance Review</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8 border">
        <h2 className="text-xl font-semibold mb-2">Run Performance Review</h2>
        <p className="text-gray-600 mb-4">
          Analyze agent performance metrics and trigger improvement mechanisms
        </p>
        <div className="flex items-center gap-4 mb-4">
          <select 
            value={reviewType} 
            onChange={(e) => setReviewType(e.target.value)}
            className="border rounded-md p-2"
          >
            <option value="daily">Daily Review</option>
            <option value="weekly">Weekly Review</option>
            <option value="monthly">Monthly Review</option>
          </select>
          <button 
            onClick={runPerformanceReview} 
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {loading ? 'Loading...' : `Run ${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)} Review`}
          </button>
        </div>
        
        {result && (
          <div className="mt-4">
            {result.success ? (
              <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-md">
                <h3 className="font-semibold">Review Completed</h3>
                <p>The performance review was completed successfully.</p>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                <h3 className="font-semibold">Error</h3>
                <p>{result.error || 'An unknown error occurred'}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {result?.success && result.metrics && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-2">Performance Metrics</h2>
          <p className="text-gray-600 mb-4">
            Results from the {reviewType} performance review
          </p>
          
          <div className="mb-4">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button className="px-4 py-2 font-medium text-blue-500 border-b-2 border-blue-500">
                  Key Metrics
                </button>
              </nav>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <MetricCard 
              title="Intent Success Rate" 
              value={`${result.metrics ? Math.round(result.metrics.intentSuccessRate * 100) : 0}%`}
              description="Percentage of successfully matched user intents"
              status={result.metrics ? getStatusForMetric(result.metrics.intentSuccessRate, 0.7, 0.9) : 'neutral'}
            />
            <MetricCard 
              title="Task Completion Rate" 
              value={`${result.metrics ? Math.round(result.metrics.taskCompletionRate * 100) : 0}%`}
              description="Percentage of successfully completed tasks"
              status={result.metrics ? getStatusForMetric(result.metrics.taskCompletionRate, 0.8, 0.95) : 'neutral'}
            />
            <MetricCard 
              title="Response Time" 
              value={`${result.metrics ? result.metrics.averageResponseTime.toFixed(2) : 0}s`}
              description="Average response time for tasks"
              status={result.metrics ? getResponseTimeStatus(result.metrics.averageResponseTime) : 'neutral'}
            />
            <MetricCard 
              title="User Satisfaction" 
              value={`${result.metrics ? result.metrics.userSatisfactionScore.toFixed(1) : 0}/5`}
              description="Estimated user satisfaction score"
              status={result.metrics ? getStatusForMetric(result.metrics.userSatisfactionScore / 5, 0.7, 0.85) : 'neutral'}
            />
            <MetricCard 
              title="Knowledge Utilization" 
              value={`${result.metrics ? Math.round(result.metrics.knowledgeUtilizationRate * 100) : 0}%`}
              description="How effectively the agent uses its knowledge base"
              status={result.metrics ? getStatusForMetric(result.metrics.knowledgeUtilizationRate, 0.6, 0.8) : 'neutral'}
            />
            <MetricCard 
              title="Memory Retrieval" 
              value={`${result.metrics ? Math.round(result.metrics.memoryRetrievalAccuracy * 100) : 0}%`}
              description="Accuracy of relevant memory retrieval"
              status={result.metrics ? getStatusForMetric(result.metrics.memoryRetrievalAccuracy, 0.7, 0.85) : 'neutral'}
            />
          </div>
          
          <div className="bg-gray-50 p-4 mt-6 text-gray-600 text-sm italic rounded">
            Metrics are calculated based on recent tasks, memories, and interactions.
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  description, 
  status
}: { 
  title: string; 
  value: string; 
  description: string; 
  status: 'good' | 'medium' | 'poor' | 'neutral';
}) {
  const statusColors = {
    good: "bg-green-50 border-green-200 text-green-800",
    medium: "bg-amber-50 border-amber-200 text-amber-800",
    poor: "bg-red-50 border-red-200 text-red-800",
    neutral: "bg-blue-50 border-blue-200 text-blue-800"
  };
  
  return (
    <div className={`border rounded-lg p-4 ${statusColors[status]}`}>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-sm mt-1 opacity-80">{description}</p>
    </div>
  );
}

function getStatusForMetric(value: number, mediumThreshold: number, goodThreshold: number): 'good' | 'medium' | 'poor' {
  if (value >= goodThreshold) return 'good';
  if (value >= mediumThreshold) return 'medium';
  return 'poor';
}

function getResponseTimeStatus(seconds: number): 'good' | 'medium' | 'poor' {
  if (seconds <= 3) return 'good';
  if (seconds <= 10) return 'medium';
  return 'poor';
} 