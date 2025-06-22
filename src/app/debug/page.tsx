'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Database, Code, Settings, Terminal } from 'lucide-react';

export default function DebugPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">CW Agent Swarm Debug Tools</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Thinking Process Visualizations */}
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:bg-gray-700 transition-colors">
            <Link href="/visualizations" className="block p-6">
              <div className="flex items-center mb-4">
                <Activity className="h-8 w-8 text-blue-400 mr-3" />
                <h2 className="text-xl font-semibold">Thinking Process Visualizations</h2>
              </div>
              <p className="text-gray-300 mb-4">
                Debug and analyze the agent&apos;s thinking process, including retrieval, reasoning, tool selection, and response generation.
              </p>
              <span className="inline-block px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm">
                New Feature
              </span>
            </Link>
          </div>
          
          {/* Memory Inspector */}
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:bg-gray-700 transition-colors">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <Database className="h-8 w-8 text-purple-400 mr-3" />
                <h2 className="text-xl font-semibold">Memory Inspector</h2>
              </div>
              <p className="text-gray-300 mb-4">
                Explore the agent&apos;s memory store, view memory items, and analyze memory retrieval patterns.
              </p>
              <span className="inline-block px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm">
                Coming Soon
              </span>
            </div>
          </div>
          
          {/* Tool Analytics */}
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:bg-gray-700 transition-colors">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <Code className="h-8 w-8 text-green-400 mr-3" />
                <h2 className="text-xl font-semibold">Tool Analytics</h2>
              </div>
              <p className="text-gray-300 mb-4">
                Track tool usage, success rates, performance metrics and debug tool execution issues.
              </p>
              <span className="inline-block px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm">
                Coming Soon
              </span>
            </div>
          </div>
          
          {/* System Configuration */}
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:bg-gray-700 transition-colors">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <Settings className="h-8 w-8 text-yellow-400 mr-3" />
                <h2 className="text-xl font-semibold">System Configuration</h2>
              </div>
              <p className="text-gray-300 mb-4">
                View and modify agent system configuration, set debug flags, and adjust performance parameters.
              </p>
              <span className="inline-block px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm">
                Coming Soon
              </span>
            </div>
          </div>
          
          {/* LLM Logs */}
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:bg-gray-700 transition-colors">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <Terminal className="h-8 w-8 text-red-400 mr-3" />
                <h2 className="text-xl font-semibold">LLM Logs</h2>
              </div>
              <p className="text-gray-300 mb-4">
                View detailed logs of LLM interactions, prompts, completions, token usage, and error reporting.
              </p>
              <span className="inline-block px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-12 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-bold mb-4">About Debug Mode</h2>
          <p className="text-gray-300 mb-4">
            The CW Agent Swarm debug tools provide insights into the inner workings of the agent system.
            Use these tools during development to understand behavior, identify issues, and optimize performance.
          </p>
          <p className="text-gray-300">
            To learn more about the agent&apos;s architecture and debugging capabilities, visit the{' '}
            <a href="https://github.com/your-repo/cw-agent-swarm" className="text-blue-400 hover:underline">
              documentation
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
} 