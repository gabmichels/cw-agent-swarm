import React, { useEffect, useState } from 'react';
import { Loader2, BarChart2, Clock, Tag, Hash } from 'lucide-react';
import { MemoryType } from '../../server/memory/config';
import useMemory from '../../hooks/useMemory';
import { MemoryEntry, TaggedMemory } from '../../lib/shared/types/agentTypes';

interface AgentMemoryStatsProps {
  agentId: string;
  className?: string;
}

interface MemoryStats {
  total: number;
  byType: Record<string, number>;
  byTimeRange: {
    lastHour: number;
    lastDay: number;
    lastWeek: number;
  };
  byTag: Record<string, number>;
}

export default function AgentMemoryStats({ agentId, className = '' }: AgentMemoryStatsProps) {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const { getAgentMemories } = useMemory();
  
  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get all memories for the agent
        const memories = await getAgentMemories(agentId, { limit: 1000 });
        
        // Calculate statistics
        const now = new Date();
        const stats: MemoryStats = {
          total: memories.length,
          byType: {},
          byTimeRange: {
            lastHour: 0,
            lastDay: 0,
            lastWeek: 0
          },
          byTag: {}
        };
        
        // Process each memory
        memories.forEach((memory: MemoryEntry) => {
          // Count by type
          const type = memory.type;
          stats.byType[type] = (stats.byType[type] || 0) + 1;
          
          // Count by time range
          const timestamp = new Date(memory.created);
          const hoursAgo = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
          
          if (hoursAgo <= 1) stats.byTimeRange.lastHour++;
          if (hoursAgo <= 24) stats.byTimeRange.lastDay++;
          if (hoursAgo <= 168) stats.byTimeRange.lastWeek++;
          
          // Count by tag if memory has tags
          if ('tags' in memory) {
            const taggedMemory = memory as TaggedMemory;
            taggedMemory.tags.forEach((tag: string) => {
              stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
            });
          }
        });
        
        setStats(stats);
      } catch (err) {
        console.error('Error loading agent memory stats:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadStats();
  }, [agentId, getAgentMemories]);
  
  if (isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="text-red-500 text-center">
          Error loading stats: {error.message}
        </div>
      </div>
    );
  }
  
  if (!stats) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="text-gray-400 text-center">
          No statistics available
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-gray-800 rounded-lg p-4 space-y-4 ${className}`}>
      <h3 className="text-lg font-medium flex items-center gap-2">
        <BarChart2 className="w-5 h-5" />
        Memory Statistics
      </h3>
      
      {/* Total memories */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 rounded p-3">
          <div className="text-sm text-gray-400">Total Memories</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        
        {/* Time-based stats */}
        <div className="bg-gray-700 rounded p-3">
          <div className="text-sm text-gray-400 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Recent Activity
          </div>
          <div className="space-y-1 mt-1">
            <div className="flex justify-between">
              <span className="text-sm">Last Hour</span>
              <span className="font-medium">{stats.byTimeRange.lastHour}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Last 24 Hours</span>
              <span className="font-medium">{stats.byTimeRange.lastDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Last Week</span>
              <span className="font-medium">{stats.byTimeRange.lastWeek}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Memory types */}
      <div className="bg-gray-700 rounded p-3">
        <div className="text-sm text-gray-400 flex items-center gap-1">
          <Hash className="w-4 h-4" />
          Memory Types
        </div>
        <div className="mt-2 space-y-1">
          {Object.entries(stats.byType)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div key={type} className="flex justify-between">
                <span className="text-sm">{type}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
        </div>
      </div>
      
      {/* Top tags */}
      {Object.keys(stats.byTag).length > 0 && (
        <div className="bg-gray-700 rounded p-3">
          <div className="text-sm text-gray-400 flex items-center gap-1">
            <Tag className="w-4 h-4" />
            Top Tags
          </div>
          <div className="mt-2 space-y-1">
            {Object.entries(stats.byTag)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([tag, count]) => (
                <div key={tag} className="flex justify-between">
                  <span className="text-sm">{tag}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
} 