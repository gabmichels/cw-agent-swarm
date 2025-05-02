'use client';

import React, { useState, useEffect } from 'react';
import KnowledgeGapDetector from '../../components/conversation/KnowledgeGapDetector';

interface KnowledgeGap {
  id: string;
  topic: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  resolved: boolean;
  detectedAt: string;
  context: string;
  resolution?: string;
}

export default function KnowledgeGapsPage() {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState('');
  const [filter, setFilter] = useState<'all' | 'resolved' | 'unresolved'>('unresolved');
  const [error, setError] = useState<string | null>(null);

  // Fetch knowledge gaps on component mount
  useEffect(() => {
    fetchKnowledgeGaps();
  }, [filter]);

  const fetchKnowledgeGaps = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/knowledge/detect-gaps?resolved=${filter === 'resolved'}`);
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge gaps');
      }
      
      const data = await response.json();
      setGaps(data.gaps || []);
      setSummary(data.summary || '');
    } catch (err) {
      console.error('Error fetching knowledge gaps:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const resolveGap = async (id: string, resolution: string) => {
    try {
      const response = await fetch('/api/knowledge/resolve-gap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, resolution }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to resolve knowledge gap');
      }
      
      // Update local state
      setGaps(prevGaps => 
        prevGaps.map(gap => 
          gap.id === id ? { ...gap, resolved: true, resolution } : gap
        )
      );
      
      // Refresh gaps to get updated data
      fetchKnowledgeGaps();
    } catch (err) {
      console.error('Error resolving knowledge gap:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleNewGapsDetected = (detectedGaps: any[]) => {
    console.log('New knowledge gaps detected:', detectedGaps);
    fetchKnowledgeGaps(); // Refresh the gaps list
  };

  const renderGapsList = () => {
    if (loading) {
      return <div className="text-center py-8">Loading knowledge gaps...</div>;
    }
    
    if (gaps.length === 0) {
      return (
        <div className="text-center py-8 bg-gray-800 rounded-lg">
          <p>No knowledge gaps found.</p>
          {filter !== 'all' && (
            <button 
              onClick={() => setFilter('all')}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            >
              Show All Gaps
            </button>
          )}
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {gaps.map(gap => (
          <div 
            key={gap.id}
            className={`p-4 rounded-lg border ${
              gap.resolved 
                ? 'bg-green-900/20 border-green-800' 
                : gap.priority === 'high'
                ? 'bg-red-900/20 border-red-800'
                : gap.priority === 'medium'
                ? 'bg-yellow-900/20 border-yellow-800'
                : 'bg-blue-900/20 border-blue-800'
            }`}
          >
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium">{gap.topic}</h3>
              <div className="flex space-x-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  gap.priority === 'high'
                    ? 'bg-red-800'
                    : gap.priority === 'medium'
                    ? 'bg-yellow-800'
                    : 'bg-blue-800'
                }`}>
                  {gap.priority} priority
                </span>
                {gap.resolved && (
                  <span className="text-xs px-2 py-1 rounded bg-green-800">
                    Resolved
                  </span>
                )}
              </div>
            </div>
            
            <p className="mt-2">{gap.description}</p>
            
            {gap.context && (
              <div className="mt-3 p-3 bg-gray-800 rounded text-sm">
                <strong>Context:</strong> {gap.context}
              </div>
            )}
            
            {gap.resolution && (
              <div className="mt-3 p-3 bg-green-900/30 border border-green-800 rounded">
                <strong>Resolution:</strong> {gap.resolution}
              </div>
            )}
            
            {!gap.resolved && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    const resolution = prompt('Enter resolution for this knowledge gap:');
                    if (resolution) {
                      resolveGap(gap.id, resolution);
                    }
                  }}
                  className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded"
                >
                  Mark as Resolved
                </button>
              </div>
            )}
            
            <div className="mt-2 text-xs text-gray-400">
              Detected: {new Date(gap.detectedAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Knowledge Gaps</h1>
        <p className="text-gray-400 mt-2">Detect and manage knowledge gaps in Chloe's understanding</p>
      </div>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Knowledge Gaps</h2>
            <div className="flex space-x-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option key="all" value="all">All Gaps</option>
                <option key="unresolved" value="unresolved">Unresolved Only</option>
                <option key="resolved" value="resolved">Resolved Only</option>
              </select>
              <button
                onClick={fetchKnowledgeGaps}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded"
              >
                Refresh
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded">
              {error}
            </div>
          )}
          
          {renderGapsList()}
        </div>
        
        <div>
          <div className="sticky top-4 bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4">Conversation Analysis</h2>
            <KnowledgeGapDetector 
              onGapsDetected={handleNewGapsDetected}
              autoAnalyze={false}
            />
            
            {summary && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Knowledge Gap Summary</h3>
                <div className="p-4 bg-gray-700 rounded whitespace-pre-wrap">
                  {summary}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 