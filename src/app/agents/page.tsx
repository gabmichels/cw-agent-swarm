'use client';

import { useEffect, useState } from 'react';
import { AgentMonitor } from '@/agents/shared/monitoring/AgentMonitor';

type AgentLog = {
  agentId: string;
  taskId: string;
  eventType: string;
  timestamp: number;
  status?: string;
  delegationContextId?: string;
  toolUsed?: string;
};

export default function AgentsDashboard() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [delegationChains, setDelegationChains] = useState<string[]>([]);

  // Refresh data every 2 seconds
  useEffect(() => {
    const fetchData = () => {
      const rawLogs = AgentMonitor.getLogs();
      setLogs(rawLogs);
      
      // Fix for Set iteration issue - convert to Array
      const uniqueAgentsSet = new Set(rawLogs.map(log => log.agentId));
      setAgents(Array.from(uniqueAgentsSet));
      
      setMetrics(AgentMonitor.getActivityMetrics());
      
      // Fix for Set iteration issue - convert to Array
      const uniqueDelegationContextsSet = new Set(
        rawLogs.map(l => l.delegationContextId).filter(Boolean)
      );
      setDelegationChains(Array.from(uniqueDelegationContextsSet) as string[]);
    };

    // Initial fetch
    fetchData();

    // Set up interval for real-time updates
    const intervalId = setInterval(fetchData, 2000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="p-6 bg-gray-900 text-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Agent Monitor Dashboard</h1>

      {/* Overview Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-gray-400 text-sm font-medium">Active Agents</h3>
          <p className="text-2xl font-semibold">{agents.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-gray-400 text-sm font-medium">Total Events</h3>
          <p className="text-2xl font-semibold">{logs.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-gray-400 text-sm font-medium">Success Rate</h3>
          <p className="text-2xl font-semibold">
            {metrics ? `${metrics.successRate}%` : 'Loading...'}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-gray-400 text-sm font-medium">Delegation Chains</h3>
          <p className="text-2xl font-semibold">{delegationChains.length}</p>
        </div>
      </section>

      {/* Active Agents */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Active Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => {
            const agentLogs = logs.filter(log => log.agentId === agent);
            const lastActive = agentLogs.length > 0 
              ? new Date(Math.max(...agentLogs.map(l => l.timestamp))).toLocaleTimeString()
              : 'N/A';
            
            return (
              <div key={agent} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="font-semibold text-lg">{agent}</h3>
                <div className="mt-2 text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>Events:</span>
                    <span>{agentLogs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Active:</span>
                    <span>{lastActive}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Delegation Chains */}
      {delegationChains.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Recent Delegation Chains</h2>
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <ul className="divide-y divide-gray-700">
              {delegationChains.slice(0, 5).map(ctx => {
                const chainLogs = logs.filter(l => l.delegationContextId === ctx);
                const initiatedBy = chainLogs[0]?.agentId || 'Unknown';
                const startTime = new Date(chainLogs[0]?.timestamp || 0).toLocaleTimeString();
                
                return (
                  <li key={ctx} className="p-3 hover:bg-gray-750">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-medium text-blue-400">{ctx}</span>
                        <div className="text-sm text-gray-400">Initiated by: {initiatedBy}</div>
                      </div>
                      <div className="text-sm text-gray-500">{startTime}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* Recent Events */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-gray-800">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Tool</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(-20).reverse().map((log, idx) => (
                <tr key={idx} className="bg-gray-800 border-b border-gray-700">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{log.agentId}</td>
                  <td className="px-4 py-2">
                    <span className={`
                      px-2 py-0.5 rounded text-xs
                      ${log.eventType === 'task_start' || log.eventType === 'task_end' ? 'bg-blue-900 text-blue-300' : ''}
                      ${log.eventType === 'tool_start' || log.eventType === 'tool_end' ? 'bg-purple-900 text-purple-300' : ''}
                      ${log.eventType === 'error' ? 'bg-red-900 text-red-300' : ''}
                      ${log.eventType === 'delegation' ? 'bg-green-900 text-green-300' : ''}
                      ${log.eventType === 'message' ? 'bg-yellow-900 text-yellow-300' : ''}
                    `}>
                      {log.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-300">{log.taskId}</td>
                  <td className="px-4 py-2">{log.toolUsed || 'n/a'}</td>
                  <td className="px-4 py-2">
                    {log.status && (
                      <span className={`
                        px-2 py-0.5 rounded text-xs
                        ${log.status === 'success' ? 'bg-green-900 text-green-300' : ''}
                        ${log.status === 'failure' ? 'bg-red-900 text-red-300' : ''}
                      `}>
                        {log.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
} 