'use client';

import { useEffect, useState } from 'react';
import { AgentMonitor } from '@/agents/shared/monitoring/AgentMonitor';
import Link from 'next/link';

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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Agent Monitor Dashboard</h1>
        
        <div className="flex space-x-4">
          <Link href="/agents/register" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white font-medium flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Register Chloe
          </Link>
        </div>
      </div>

      {/* Multi-Agent System Integration Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-lg p-6 mb-8 shadow-md">
        <h2 className="text-xl font-bold mb-2">Multi-Agent System Integration</h2>
        <p className="mb-4">Register Chloe in our new multi-agent architecture to remove hardcoded values and enable dynamic agent-to-chat relationships.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/agents/register" className="bg-white text-blue-900 hover:bg-blue-100 px-4 py-2 rounded font-medium">
            Register Chloe Now
          </Link>
          <Link href="/docs/multi-agent" className="bg-transparent text-white border border-white hover:bg-white/10 px-4 py-2 rounded font-medium">
            Learn More
          </Link>
        </div>
      </div>

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