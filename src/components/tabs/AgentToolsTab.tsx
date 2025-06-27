import React, { useEffect, useState } from 'react';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  costEstimate: string | number;
  usageLimit: number | null;
  version: string;
}

interface AgentToolsData {
  agentId: string;
  agentName: string;
  agentType: string;
  hasToolManager: boolean;
  tools: Tool[];
  toolCategories: Record<string, Tool[]>;
  toolCount: number;
  error: string | null;
}

interface ToolsAuditSummary {
  totalAgents: number;
  totalTools: number;
  averageToolsPerAgent: number;
  agentsWithTools: number;
  agentsWithoutTools: number;
  toolsBreakdown: {
    apifyTools: number;
    workspaceTools: number;
    coreTools: number;
    otherTools: number;
  };
}

interface AgentToolsResponse {
  success: boolean;
  timestamp: string;
  agents: AgentToolsData[];
  summary: ToolsAuditSummary;
  message: string;
  error?: string;
}

interface AgentToolsTabProps {
  agentId?: string;
}

const AgentToolsTab: React.FC<AgentToolsTabProps> = ({ agentId }) => {
  const [toolsData, setToolsData] = useState<AgentToolsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchAgentTools = async () => {
    setIsLoading(true);
    try {
      const url = agentId ? `/api/debug/agent-tools?agentId=${encodeURIComponent(agentId)}` : '/api/debug/agent-tools';
      const response = await fetch(url);
      const data: AgentToolsResponse = await response.json();
      setToolsData(data);
      
      // Auto-expand first agent if there's only one
      if (data.success && data.agents.length === 1) {
        setExpandedAgents(new Set([data.agents[0].agentId]));
      }
    } catch (error) {
      console.error('Error fetching agent tools:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentTools();
  }, [agentId]);

  const toggleAgentExpansion = (agentId: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  const toggleCategoryExpansion = (categoryKey: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryIcon = (category: string) => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('workspace') || lowerCategory.includes('email') || lowerCategory.includes('calendar')) {
      return '🏢';
    } else if (lowerCategory.includes('apify') || lowerCategory.includes('social') || lowerCategory.includes('web')) {
      return '🌐';
    } else if (lowerCategory.includes('core') || lowerCategory.includes('message')) {
      return '⚙️';
    } else if (lowerCategory.includes('market') || lowerCategory.includes('research')) {
      return '📊';
    }
    return '🔧';
  };

  const getCostBadgeColor = (costEstimate: string | number) => {
    // Convert to string and handle both string and number types
    const costStr = String(costEstimate).toLowerCase();
    
    switch (costStr) {
      case 'low': return 'bg-green-900 text-green-300 border-green-700';
      case 'medium': return 'bg-yellow-900 text-yellow-300 border-yellow-700';
      case 'high': return 'bg-red-900 text-red-300 border-red-700';
      case '1': return 'bg-green-900 text-green-300 border-green-700'; // Low cost
      case '2': return 'bg-yellow-900 text-yellow-300 border-yellow-700'; // Medium cost
      case '3':
      case '4':
      case '5': return 'bg-red-900 text-red-300 border-red-700'; // High cost
      default: return 'bg-gray-700 text-gray-300 border-gray-600';
    }
  };

  const getFilteredTools = (tools: Tool[]) => {
    return tools.filter(tool => {
      const matchesSearch = searchFilter === '' || 
        tool.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchFilter.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || tool.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  };

  const getAllCategories = () => {
    if (!toolsData?.agents) return [];
    
    const categories = new Set<string>();
    toolsData.agents.forEach(agent => {
      (agent.tools || []).forEach(tool => {
        categories.add(tool.category);
      });
    });
    
    return Array.from(categories).sort();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading agent tools...</span>
        </div>
      </div>
    );
  }

  if (!toolsData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <p className="text-red-600">Failed to load agent tools</p>
          <button 
            onClick={fetchAgentTools}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!toolsData.success) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <p className="text-red-600">Error: {toolsData.error}</p>
          <button 
            onClick={fetchAgentTools}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const allCategories = getAllCategories();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            🔧 {agentId ? 'Agent Tools' : 'Agent Tools Registry'}
          </h1>
          <p className="text-gray-400 mt-1">
            {agentId 
              ? 'Tools registered and available to this agent at runtime' 
              : 'All tools registered and available to agents at runtime'
            }
          </p>
        </div>
        <button
          onClick={fetchAgentTools}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          ⚙️ Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300">
            {agentId ? 'Agent Status' : 'Total Agents'}
          </h3>
          <div className="text-2xl font-bold mt-1 text-white">
            {isLoading ? (
              <div className="h-8 bg-gray-600 rounded animate-pulse w-16"></div>
            ) : agentId ? 'Active' : (toolsData.summary?.totalAgents || 0)}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isLoading ? (
              <div className="h-3 bg-gray-600 rounded animate-pulse w-24"></div>
            ) : agentId 
              ? `Tools available: ${toolsData.summary?.totalTools || 0}` 
              : `${toolsData.summary?.agentsWithTools || 0} with tools, ${toolsData.summary?.agentsWithoutTools || 0} without`
            }
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300">Total Tools</h3>
          <div className="text-2xl font-bold mt-1 text-white">
            {isLoading ? (
              <div className="h-8 bg-gray-600 rounded animate-pulse w-12"></div>
            ) : (toolsData.summary?.totalTools || 0)}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isLoading ? (
              <div className="h-3 bg-gray-600 rounded animate-pulse w-20"></div>
            ) : `Avg ${toolsData.summary?.averageToolsPerAgent || 0} per agent`}
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300">Apify Tools</h3>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {isLoading ? (
              <div className="h-8 bg-gray-600 rounded animate-pulse w-10"></div>
            ) : (toolsData.summary.toolsBreakdown?.apifyTools || 0)}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isLoading ? (
              <div className="h-3 bg-gray-600 rounded animate-pulse w-28"></div>
            ) : 'Social media & scraping'}
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300">Workspace Tools</h3>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {isLoading ? (
              <div className="h-8 bg-gray-600 rounded animate-pulse w-10"></div>
            ) : (toolsData.summary.toolsBreakdown?.workspaceTools || 0)}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isLoading ? (
              <div className="h-3 bg-gray-600 rounded animate-pulse w-24"></div>
            ) : 'Email, calendar, docs'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search tools by name or description..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            disabled={isLoading}
            className="px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="all">All Categories</option>
            {allCategories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Agents List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-300">Loading agent tools...</span>
            </div>
            <div className="mt-4 space-y-3">
              {/* Skeleton loading placeholders */}
              <div className="animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-600 rounded w-1/2"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-2/3 mb-2"></div>
                <div className="h-3 bg-gray-600 rounded w-1/3"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-4/5 mb-2"></div>
                <div className="h-3 bg-gray-600 rounded w-2/5"></div>
              </div>
            </div>
          </div>
        ) : (toolsData.agents || []).map((agent) => (
          <div key={agent.agentId} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                          <div 
                className="p-4 hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => toggleAgentExpansion(agent.agentId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {expandedAgents.has(agent.agentId) ? '🔽' : '▶️'}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{agent.agentName}</h3>
                      <p className="text-sm text-gray-400">
                        {agent.agentType} • {agent.agentId.substring(0, 8)}...
                      </p>
                    </div>
                  </div>
                <div className="flex items-center gap-2">
                  {agent.error ? (
                    <span className="px-2 py-1 bg-red-900 text-red-300 rounded text-sm">
                      ⚠️ Error
                    </span>
                  ) : agent.hasToolManager ? (
                    <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-sm">
                      ✅ {agent.toolCount} tools
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-600 text-gray-300 rounded text-sm">
                      ⚠️ No tools
                    </span>
                  )}
                </div>
              </div>
            </div>

            {expandedAgents.has(agent.agentId) && (
              <div className="border-t border-gray-600">
                <div className="p-4 bg-gray-900">
                  {agent.error ? (
                    <div className="bg-red-900 border border-red-700 rounded-md p-4">
                      <p className="text-red-300 font-medium">Error loading tools:</p>
                      <p className="text-red-400 text-sm mt-1">{agent.error}</p>
                    </div>
                  ) : agent.toolCount === 0 ? (
                    <div className="bg-yellow-900 border border-yellow-700 rounded-md p-4">
                      <p className="text-yellow-300">No tools registered for this agent</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(agent.toolCategories).map(([category, categoryTools]) => {
                        const filteredTools = getFilteredTools(categoryTools);
                        if (filteredTools.length === 0) return null;

                        const categoryKey = `${agent.agentId}-${category}`;
                        return (
                          <div key={category} className="border border-gray-600 rounded-md">
                            <div 
                              className="p-3 hover:bg-gray-700 transition-colors cursor-pointer"
                              onClick={() => toggleCategoryExpansion(categoryKey)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white">
                                    {expandedCategories.has(categoryKey) ? '🔽' : '▶️'}
                                  </span>
                                  <span className="text-lg">{getCategoryIcon(category)}</span>
                                  <span className="font-medium capitalize text-white">{category}</span>
                                </div>
                                <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-sm">
                                  {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>

                            {expandedCategories.has(categoryKey) && (
                              <div className="border-t border-gray-600">
                                <div className="grid gap-3 p-3 bg-gray-800">
                                  {filteredTools.map((tool) => (
                                    <div key={tool.id} className="border border-gray-600 rounded-md p-3 bg-gray-700">
                                      <div className="flex items-start justify-between mb-2">
                                        <div>
                                          <h4 className="font-medium text-sm text-white">{tool.name}</h4>
                                          <p className="text-xs text-gray-300 mt-1">{tool.description}</p>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                          <span className={`px-2 py-1 rounded text-xs ${getCostBadgeColor(tool.costEstimate)}`}>
                                            {tool.costEstimate}
                                          </span>
                                          {!tool.enabled && (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                                              Disabled
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-gray-400">
                                        <span>ID: {tool.id}</span>
                                        <div className="flex gap-2">
                                          {tool.usageLimit && (
                                            <span>Limit: {tool.usageLimit}/day</span>
                                          )}
                                          <span>v{tool.version}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLoading && (toolsData.agents || []).length === 0 && (
        <div className="text-center p-8">
          <div className="text-gray-400 text-xl mb-2">⚠️</div>
          <p className="text-gray-400">No agents found in runtime registry</p>
          <p className="text-gray-500 text-sm mt-2">
            If this persists, agents may need to be bootstrapped.
          </p>
          <button 
            onClick={fetchAgentTools}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            🔄 Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default AgentToolsTab; 