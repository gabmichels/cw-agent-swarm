'use client';

import React, { useState, useEffect } from 'react';
import { AgentMetadata } from '../../types/metadata';

export interface PersonalAgentsViewProps {
  agents: AgentMetadata[];
  onAgentSelect?: (agent: AgentMetadata) => void;
  onCreateAgent?: (category?: string) => void;
  className?: string;
}

interface AgentCategory {
  name: string;
  icon: string;
  color: string;
  description: string;
  agents: AgentMetadata[];
}

/**
 * Personal Agents View Component
 * Organizes agents by categories for personal use
 */
export const PersonalAgentsView: React.FC<PersonalAgentsViewProps> = ({
  agents,
  onAgentSelect,
  onCreateAgent,
  className = ''
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Default categories for personal mode
  const defaultCategories = [
    {
      name: 'Productivity',
      icon: '⚡',
      color: 'bg-blue-500',
      description: 'Task management, scheduling, and workflow optimization'
    },
    {
      name: 'Finance',
      icon: '💰',
      color: 'bg-green-500',
      description: 'Budgeting, investment tracking, and financial planning'
    },
    {
      name: 'Health',
      icon: '🏥',
      color: 'bg-red-500',
      description: 'Wellness tracking, medical reminders, and health insights'
    },
    {
      name: 'Learning',
      icon: '📚',
      color: 'bg-purple-500',
      description: 'Education, skill development, and knowledge management'
    },
    {
      name: 'Communication',
      icon: '💬',
      color: 'bg-yellow-500',
      description: 'Email management, social media, and messaging'
    },
    {
      name: 'Entertainment',
      icon: '🎮',
      color: 'bg-pink-500',
      description: 'Content recommendations, gaming, and leisure activities'
    },
    {
      name: 'Home',
      icon: '🏠',
      color: 'bg-indigo-500',
      description: 'Smart home management, maintenance, and organization'
    },
    {
      name: 'Travel',
      icon: '✈️',
      color: 'bg-cyan-500',
      description: 'Trip planning, booking assistance, and travel guides'
    }
  ];

  // Organize agents by category
  const categorizedAgents: AgentCategory[] = defaultCategories.map(category => ({
    ...category,
    agents: agents.filter(agent => 
      agent.category?.toLowerCase() === category.name.toLowerCase() ||
      (!agent.category && category.name === 'Productivity') // Default category
    )
  }));

  // Add uncategorized agents
  const uncategorizedAgents = agents.filter(agent => 
    !agent.category || 
    !defaultCategories.some(cat => 
      cat.name.toLowerCase() === agent.category?.toLowerCase()
    )
  );

  if (uncategorizedAgents.length > 0) {
    categorizedAgents.push({
      name: 'Other',
      icon: '📦',
      color: 'bg-gray-500',
      description: 'Uncategorized agents',
      agents: uncategorizedAgents
    });
  }

  // Filter agents based on search query
  const filteredCategories = categorizedAgents.map(category => ({
    ...category,
    agents: category.agents.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => 
    searchQuery === '' || category.agents.length > 0
  );

  const totalAgents = agents.length;
  const activeAgents = agents.filter(agent => agent.status === 'available').length;

  return (
    <div className={`personal-agents-view ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">My Agents</h1>
            <p className="text-gray-400 mt-1">
              {totalAgents} agents • {activeAgents} active
            </p>
          </div>
          <button
            onClick={() => onCreateAgent?.()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Agent
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCategories.map((category) => (
          <div
            key={category.name}
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all duration-200"
          >
            {/* Category Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`w-10 h-10 ${category.color} rounded-lg flex items-center justify-center mr-3`}>
                  <span className="text-xl">{category.icon}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                  <p className="text-sm text-gray-400">{category.agents.length} agents</p>
                </div>
              </div>
              <button
                onClick={() => onCreateAgent?.(category.name)}
                className="text-gray-400 hover:text-white transition-colors duration-200"
                title={`Create ${category.name} agent`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            </div>

            {/* Category Description */}
            <p className="text-sm text-gray-400 mb-4">{category.description}</p>

            {/* Agents List */}
            <div className="space-y-2">
              {category.agents.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">No agents yet</p>
                  <button
                    onClick={() => onCreateAgent?.(category.name)}
                    className="text-blue-400 hover:text-blue-300 text-sm mt-1 transition-colors duration-200"
                  >
                    Create your first {category.name.toLowerCase()} agent
                  </button>
                </div>
              ) : (
                category.agents.slice(0, 3).map((agent) => (
                  <div
                    key={agent.agentId}
                    onClick={() => onAgentSelect?.(agent)}
                    className="flex items-center p-3 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer transition-colors duration-200"
                  >
                                         <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                       agent.status === 'available' ? 'bg-green-500' : 
                       agent.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'
                     }`}>
                      <span className="text-white text-xs font-bold">
                        {agent.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                      <p className="text-xs text-gray-400 truncate">{agent.position || 'Personal Assistant'}</p>
                    </div>
                                         <div className={`w-2 h-2 rounded-full ${
                       agent.status === 'available' ? 'bg-green-400' : 
                       agent.status === 'busy' ? 'bg-yellow-400' : 'bg-gray-400'
                     }`} />
                  </div>
                ))
              )}
              
              {category.agents.length > 3 && (
                <button
                  onClick={() => setSelectedCategory(category.name)}
                  className="w-full text-center py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
                >
                  View all {category.agents.length} agents
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {totalAgents === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No agents yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create your first AI agent to get started. Choose from our categories or create a custom agent for your specific needs.
          </p>
          <button
            onClick={() => onCreateAgent?.()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200"
          >
            Create Your First Agent
          </button>
        </div>
      )}
    </div>
  );
};

export default PersonalAgentsView; 