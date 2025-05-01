'use client';

import { useEffect, useState } from 'react';
import { AgentMonitor } from '@/agents/shared/monitoring/AgentMonitor';

// Define types to match the structure from AgentMonitor
interface AgentEvent {
  agentId: string;
  taskId: string;
  eventType: string;
  timestamp: number;
  metadata?: {
    type?: string;
    ruleId?: string;
    description?: string;
    severity?: 'low' | 'medium' | 'high';
    snippet?: string;
    [key: string]: any;
  };
  status?: string;
  durationMs?: number;
  errorMessage?: string;
  parentTaskId?: string;
  delegationContextId?: string;
  tags?: string[];
}

export default function EthicsPage() {
  const [violations, setViolations] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchViolations = () => {
    setLoading(true);
    // Get all logs and filter for ethics violations
    const allLogs = AgentMonitor.getLogs();
    const ethics = allLogs.filter(log => 
      log.eventType === 'error' && 
      log.metadata?.type === 'ethics_violation'
    );
    setViolations(ethics.slice(-20).reverse()); // Most recent 20 violations
    setLoading(false);
  };

  useEffect(() => {
    fetchViolations();
  }, []);

  const violationStats = {
    total: violations.length,
    high: violations.filter(v => v.metadata?.severity === 'high').length,
    medium: violations.filter(v => v.metadata?.severity === 'medium').length,
    low: violations.filter(v => v.metadata?.severity === 'low').length,
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Ethics Monitor</h1>
        <button 
          onClick={fetchViolations}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>
      </div>

      {/* 🛡️ Ethics Section */}
      <section className="mb-12 border rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-800">
        <div className="bg-gray-50 dark:bg-gray-700 p-4 border-b dark:border-gray-600">
          <h2 className="text-xl font-semibold dark:text-white">⚖️ Ethics Violations</h2>
          <div className="mt-2 text-sm flex space-x-4">
            <div className="px-3 py-1 bg-gray-100 dark:bg-gray-600 dark:text-gray-200 rounded-full">
              Total: {violationStats.total}
            </div>
            <div className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 rounded-full font-medium">
              High: {violationStats.high}
            </div>
            <div className="px-3 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 rounded-full">
              Medium: {violationStats.medium}
            </div>
            <div className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 rounded-full">
              Low: {violationStats.low}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-300">Loading violations...</p>
          </div>
        ) : violations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead className="bg-gray-100 dark:bg-gray-700 dark:text-gray-200">
                <tr>
                  <th className="p-3 text-left">Agent</th>
                  <th className="p-3 text-left">Rule</th>
                  <th className="p-3 text-left">Severity</th>
                  <th className="p-3 text-left">Snippet</th>
                  <th className="p-3 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-300">
                {violations.map((v, idx) => (
                  <tr key={idx} className={`border-t dark:border-gray-600 ${v.metadata?.severity === 'high' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                    <td className="p-3 font-medium">{v.agentId}</td>
                    <td className="p-3">{v.metadata?.ruleId}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        v.metadata?.severity === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' : 
                        v.metadata?.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' : 
                        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                      }`}>
                        {v.metadata?.severity}
                      </span>
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300 truncate max-w-xs">
                      {v.metadata?.snippet ? (
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap max-w-xs" title={v.metadata.snippet}>
                          {v.metadata.snippet}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 italic">No snippet available</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{new Date(v.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">✓ No ethics violations recorded</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">All agents are operating within ethical boundaries</p>
          </div>
        )}
      </section>
    </div>
  );
} 