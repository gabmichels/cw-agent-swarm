'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Type definitions for UI component props
interface ComponentBaseProps {
  children?: ReactNode;
  className?: string;
}

interface CardProps extends ComponentBaseProps {}

interface CardHeaderProps extends ComponentBaseProps {}

interface CardTitleProps extends ComponentBaseProps {}

interface CardContentProps extends ComponentBaseProps {}

interface ButtonProps extends ComponentBaseProps {
  onClick?: () => void;
  variant?: 'default' | 'outline';
}

interface TabsProps {
  children?: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
}

interface TabsListProps extends ComponentBaseProps {}

interface TabsTriggerProps {
  children?: ReactNode;
  value: string;
  className?: string;
  onValueChange?: (value: string) => void;
}

interface TabsContentProps {
  children?: ReactNode;
  value: string;
  className?: string;
}

interface BadgeProps extends ComponentBaseProps {
  variant?: 'default' | 'secondary' | 'outline';
}

// UI component implementations
const Card = ({ children, className = '' }: CardProps) => (
  <div className={`border rounded-lg shadow-sm overflow-hidden ${className}`}>{children}</div>
);

const CardHeader = ({ children, className = '' }: CardHeaderProps) => (
  <div className={`p-4 border-b ${className}`}>{children}</div>
);

const CardTitle = ({ children, className = '' }: CardTitleProps) => (
  <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>
);

const CardContent = ({ children, className = '' }: CardContentProps) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

const Button = ({ children, onClick, variant = 'default', className = '' }: ButtonProps) => {
  const variantClasses = variant === 'default' 
    ? 'bg-blue-500 text-white' 
    : 'bg-gray-100 text-gray-800 border';
  
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md font-medium ${variantClasses} ${className}`}
    >
      {children}
    </button>
  );
};

const Tabs = ({ children, value, onValueChange }: TabsProps) => (
  <div>{children}</div>
);

const TabsList = ({ children, className = '' }: TabsListProps) => (
  <div className={`flex border-b ${className}`}>{children}</div>
);

const TabsTrigger = ({ children, value, className = '', onValueChange }: TabsTriggerProps) => {
  return (
    <button
      className={`px-4 py-2 ${className} ${onValueChange ? 'cursor-pointer' : ''}`}
      onClick={() => onValueChange && onValueChange(value)}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ children, value, className = '' }: TabsContentProps) => (
  <div className={`py-4 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default', className = '' }: BadgeProps) => {
  const variantClasses = variant === 'secondary' 
    ? 'bg-gray-100 text-gray-800' 
    : variant === 'outline'
    ? 'border border-gray-300 text-gray-600'
    : 'bg-blue-100 text-blue-800';
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};

interface MaintenanceLog {
  id: string;
  timestamp: string;
  content: string;
  type: string;
  tags: string[];
}

interface GraphInsight {
  id: string;
  timestamp: string;
  content: string;
  source: string;
}

export default function ChloeMaintenance() {
  const router = useRouter();
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [insights, setInsights] = useState<GraphInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('maintenance');
  const [timeframe, setTimeframe] = useState('week');

  // Fetch maintenance logs and insights
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // In a real implementation, these would be API calls to fetch data
        // For now, we're using mock data
        const response = await fetch(`/api/chloe/maintenance?timeframe=${timeframe}`);
        if (response.ok) {
          const data = await response.json();
          setMaintenanceLogs(data.maintenanceLogs);
          setInsights(data.insights);
        } else {
          console.error('Failed to fetch maintenance data');
          // Use mock data for demo purposes
          setMaintenanceLogs(getMockMaintenanceLogs());
          setInsights(getMockInsights());
        }
      } catch (error) {
        console.error('Error fetching maintenance data:', error);
        // Use mock data for demo purposes
        setMaintenanceLogs(getMockMaintenanceLogs());
        setInsights(getMockInsights());
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeframe]);

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Chloe Self-Maintenance Dashboard</h1>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Maintenance Cycles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{maintenanceLogs.filter(log => log.type === 'maintenance_log').length}</p>
            <p className="text-sm text-muted-foreground">Total runs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Knowledge Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{insights.length}</p>
            <p className="text-sm text-muted-foreground">Discovered patterns</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Last Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            {maintenanceLogs.length > 0 ? (
              <>
                <p className="text-xl font-bold">
                  {new Date(maintenanceLogs[0].timestamp).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(maintenanceLogs[0].timestamp).toLocaleTimeString()}
                </p>
              </>
            ) : (
              <p className="text-xl">No maintenance run yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="space-x-2">
          <Button 
            variant={timeframe === 'week' ? 'default' : 'outline'} 
            onClick={() => setTimeframe('week')}
          >
            This Week
          </Button>
          <Button 
            variant={timeframe === 'month' ? 'default' : 'outline'} 
            onClick={() => setTimeframe('month')}
          >
            This Month
          </Button>
          <Button 
            variant={timeframe === 'all' ? 'default' : 'outline'} 
            onClick={() => setTimeframe('all')}
          >
            All Time
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="maintenance">Maintenance Logs</TabsTrigger>
          <TabsTrigger value="insights">Knowledge Insights</TabsTrigger>
        </TabsList>
        
        <TabsContent value="maintenance">
          <div className="space-y-4">
            {isLoading ? (
              <p>Loading maintenance logs...</p>
            ) : maintenanceLogs.length > 0 ? (
              maintenanceLogs.map((log) => (
                <Card key={log.id}>
                  <CardHeader>
                    <div className="flex justify-between">
                      <CardTitle className="text-lg">{log.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {log.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line">{log.content}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p>No maintenance logs found for the selected timeframe.</p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="insights">
          <div className="space-y-4">
            {isLoading ? (
              <p>Loading insights...</p>
            ) : insights.length > 0 ? (
              insights.map((insight) => (
                <Card key={insight.id}>
                  <CardHeader>
                    <div className="flex justify-between">
                      <CardTitle className="text-lg">Knowledge Insight</CardTitle>
                      <span className="text-sm text-muted-foreground">
                        {new Date(insight.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <Badge variant="outline">{insight.source}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line">{insight.content}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p>No insights found for the selected timeframe.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Mock data for demonstration
function getMockMaintenanceLogs(): MaintenanceLog[] {
  return [
    {
      id: 'maint-1',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'maintenance_log',
      content: `Autonomous Maintenance Completed:
      - Memory consolidation: 1,245 memories processed
      - Knowledge optimization: 
        - Pruned 23 stale nodes
        - Discovered 37 new relationships
        - Generated 5 insights`,
      tags: ['maintenance', 'autonomous', 'self_improvement']
    },
    {
      id: 'maint-2',
      timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'maintenance_log',
      content: `Autonomous Maintenance Completed:
      - Memory consolidation: 982 memories processed
      - Knowledge optimization: 
        - Pruned 18 stale nodes
        - Discovered 29 new relationships
        - Generated 3 insights`,
      tags: ['maintenance', 'autonomous', 'self_improvement']
    },
    {
      id: 'clean-1',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'memory_cleanup',
      content: `Memory Cleanup Completed:
      - Consolidated 75 similar memories
      - Archived 28 low-relevance memories
      - Updated 13 memory links`,
      tags: ['memory', 'cleanup', 'consolidation']
    }
  ];
}

function getMockInsights(): GraphInsight[] {
  return [
    {
      id: 'insight-1',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'Knowledge Graph',
      content: `Most central concepts: Content Strategy (12 connections), Twitter API (9 connections), Market Research (8 connections)
        
Most common knowledge types: tool (45 nodes), concept (32 nodes), project (28 nodes)
        
Trending knowledge areas: market_research (8 new nodes), twitter (6 new nodes), content (5 new nodes)
        
Potential knowledge gaps in: competitors, product_roadmap, user_feedback`
    },
    {
      id: 'insight-2',
      timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'Knowledge Graph',
      content: `Most central concepts: Market Research (10 connections), Content Strategy (9 connections), User Personas (7 connections)
        
Most common knowledge types: tool (42 nodes), concept (30 nodes), project (25 nodes)
        
High-importance knowledge areas: content (12 nodes), social_media (8 nodes), analytics (7 nodes)`
    },
    {
      id: 'insight-3',
      timestamp: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'Topic Analysis',
      content: `Topic clusters identified in recent activities:
      
1. Content Creation (32% of recent activities)
   - Blog posts
   - Social media updates
   - Video scripts
      
2. Competitive Analysis (28% of recent activities)
   - Market positioning
   - Feature comparison
   - Pricing strategies
      
3. User Engagement (18% of recent activities)
   - Feedback collection
   - Community engagement
   - Retention strategies`
    }
  ];
} 