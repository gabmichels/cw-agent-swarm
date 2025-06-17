import React, { useEffect, useState } from 'react';
import { ScheduledTask } from '../../types';
import { 
  PlayIcon, 
  PauseIcon, 
  RefreshCw, 
  WrenchIcon, 
  BugIcon, 
  Calendar, 
  ListTodo, 
  Filter, 
  SortAsc, 
  SortDesc, 
  Eye, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  UserCheck,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from 'lucide-react';
import { TASK_IDS } from '../../lib/shared/constants';

interface TasksTabProps {
  isLoadingTasks: boolean;
  scheduledTasks: ScheduledTask[];
  runTaskNow: (taskId: string) => Promise<void>;
  toggleTaskEnabled: (taskId: string, enabled: boolean) => Promise<void>;
  formatCronExpression: (cronExp: string) => string;
  chatId?: string;
  userId?: string;
}

// Types for self-created tasks
interface SelfCreatedTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledTime: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: {
    success: boolean;
    data?: any;
    error?: string;
    duration?: number;
  };
  metadata?: {
    source: string;
    originalMessage: string;
    intent?: string;
    complexity?: number;
  };
}

// Types for approval requests
interface ApprovalRequest {
  id: string;
  taskId: string;
  taskName: string;
  taskDescription: string;
  taskType: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  draftContent?: string;
  scheduledTime?: string;
  requestedAt: string;
  requestedBy: string;
  chatId: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalNotes?: string;
  approvalDecidedAt?: string;
}

// Sub-tab types
type TabType = 'scheduled' | 'tasks' | 'approvals';

const TasksTab: React.FC<TasksTabProps> = ({
  isLoadingTasks,
  scheduledTasks,
  runTaskNow,
  toggleTaskEnabled,
  formatCronExpression,
  chatId,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [debugResult, setDebugResult] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefreshCount, setManualRefreshCount] = useState(0);
  
  // Task board state
  const [selfCreatedTasks, setSelfCreatedTasks] = useState<SelfCreatedTask[]>([]);
  const [isLoadingTaskBoard, setIsLoadingTaskBoard] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'scheduledTime' | 'createdAt' | 'priority'>('scheduledTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTaskResult, setSelectedTaskResult] = useState<SelfCreatedTask | null>(null);
  
  // Approval state
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<string>('pending');
  const [selectedApprovalRequest, setSelectedApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Function to clean task names by removing department names in braces
  const cleanTaskName = (name: string) => {
    return name?.replace(/\s*\([^)]*\)\s*/g, '') || 'Unnamed Task';
  };

  // Function to safely format dates
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Never';
    
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      console.warn('Error parsing date:', error);
      return 'Invalid date';
    }
  };

  // Function to format relative time
  const formatRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch (error) {
      return 'Unknown';
    }
  };

  // Function to get status icon and color
  const getStatusDisplay = (status: SelfCreatedTask['status']) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-100 text-yellow-800' };
      case 'in_progress':
        return { icon: AlertCircle, color: 'text-blue-400', bg: 'bg-blue-100 text-blue-800' };
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-100 text-green-800' };
      case 'failed':
        return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-100 text-red-800' };
      default:
        return { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-100 text-gray-800' };
    }
  };

  // Function to get priority display
  const getPriorityDisplay = (priority: SelfCreatedTask['priority']) => {
    switch (priority) {
      case 'urgent':
        return { color: 'bg-red-500 text-white', label: 'Urgent' };
      case 'high':
        return { color: 'bg-orange-500 text-white', label: 'High' };
      case 'medium':
        return { color: 'bg-yellow-500 text-white', label: 'Medium' };
      case 'low':
        return { color: 'bg-green-500 text-white', label: 'Low' };
      default:
        return { color: 'bg-gray-500 text-white', label: 'Normal' };
    }
  };

  // Fetch self-created tasks
  const fetchSelfCreatedTasks = async () => {
    setIsLoadingTaskBoard(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (chatId) params.append('chatId', chatId);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('limit', '50');
      params.append('offset', '0');
      
      console.log('Fetching self-created tasks with params:', Object.fromEntries(params));
      
      const response = await fetch(`/api/tasks/self-created?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('API response:', data);
        setSelfCreatedTasks(data.tasks || []);
      } else {
        console.error('Failed to fetch self-created tasks:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
        
        // Only fall back to mock data in development if no real tasks found
        if (process.env.NODE_ENV === 'development') {
          console.log('Falling back to mock data for development');
          setSelfCreatedTasks(getMockTasks());
        } else {
          setSelfCreatedTasks([]);
        }
      }
    } catch (error) {
      console.error('Error fetching self-created tasks:', error);
      
      // Only fall back to mock data in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Falling back to mock data due to error');
        setSelfCreatedTasks(getMockTasks());
      } else {
        setSelfCreatedTasks([]);
      }
    } finally {
      setIsLoadingTaskBoard(false);
    }
  };

  // Fetch approval requests
  const fetchApprovalRequests = async () => {
    setIsLoadingApprovals(true);
    try {
      const params = new URLSearchParams();
      if (chatId) params.append('chatId', chatId);
      
      console.log('Fetching approval requests with params:', Object.fromEntries(params));
      
      const response = await fetch(`/api/tasks/approval?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Approval API response:', data);
        
        // Transform API response to match our interface
        const approvals: ApprovalRequest[] = (data.approvals || []).map((approval: any) => ({
          id: approval.id || approval.taskId,
          taskId: approval.taskId || approval.id,
          taskName: approval.type ? `${approval.type.charAt(0).toUpperCase() + approval.type.slice(1)} Task` : 'Unknown Task',
          taskDescription: approval.content || 'No description available',
          taskType: approval.type || 'unknown',
          priority: approval.priority || 'medium',
          draftContent: approval.content,
          scheduledTime: approval.scheduledTime,
          requestedAt: approval.requestedAt || new Date().toISOString(),
          requestedBy: 'AI Agent',
          chatId: approval.chatId || chatId || 'unknown',
          status: 'pending'
        }));
        
        setApprovalRequests(approvals);
      } else {
        console.error('Failed to fetch approval requests:', response.status, response.statusText);
        
        // Fall back to mock data in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Falling back to mock approval data for development');
          setApprovalRequests(getMockApprovalRequests());
        } else {
          setApprovalRequests([]);
        }
      }
    } catch (error) {
      console.error('Error fetching approval requests:', error);
      
      // Fall back to mock data in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Falling back to mock approval data due to error');
        setApprovalRequests(getMockApprovalRequests());
      } else {
        setApprovalRequests([]);
      }
    } finally {
      setIsLoadingApprovals(false);
    }
  };

  // Handle approval decision
  const handleApprovalDecision = async (approved: boolean, taskId: string, notes?: string) => {
    setIsProcessingApproval(true);
    try {
      const response = await fetch('/api/tasks/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          decision: approved ? 'approved' : 'rejected',
          notes,
          chatId: chatId || 'default'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Approval decision processed:', data);
        
        // Update the approval request in state
        setApprovalRequests(prev => prev.map(request => 
          request.taskId === taskId 
            ? {
                ...request,
                status: approved ? 'approved' : 'rejected',
                approvedBy: userId || 'current-user',
                approvalNotes: notes,
                approvalDecidedAt: new Date().toISOString()
              }
            : request
        ));
        
        // Close the modal
        setSelectedApprovalRequest(null);
        setApprovalNotes('');
        
        // Show success message
        console.log(`Task ${approved ? 'approved' : 'rejected'} successfully!`);
      } else {
        console.error('Failed to process approval decision:', response.status);
        throw new Error('Failed to process approval decision');
      }
    } catch (error) {
      console.error('Error processing approval decision:', error);
      throw error;
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Mock approval data for development
  const getMockApprovalRequests = (): ApprovalRequest[] => [
    {
      id: 'approval_001',
      taskId: 'task_approval_001',
      taskName: 'Tweet about AI Agents',
      taskDescription: 'Post a tweet about the future of AI agents and their impact on productivity',
      taskType: 'tweet',
      priority: 'medium',
      draftContent: '🚀 The future of AI agents is here! They\'re transforming how we work, automating complex tasks, and enabling us to focus on what matters most. Excited to see where this technology takes us! #AIAgents #Productivity #Future',
      scheduledTime: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), // 2 hours from now
      requestedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 minutes ago
      requestedBy: 'Marketing Agent',
      chatId: chatId || 'default',
      status: 'pending'
    },
    {
      id: 'approval_002',
      taskId: 'task_approval_002',
      taskName: 'Send Email to Team',
      taskDescription: 'Send weekly update email to the development team',
      taskType: 'email',
      priority: 'high',
      draftContent: 'Subject: Weekly Development Update\n\nHi team,\n\nHere\'s our progress this week:\n- Completed approval system integration\n- Enhanced task management UI\n- Improved error handling\n\nGreat work everyone!\n\nBest regards,\nAI Assistant',
      scheduledTime: new Date(Date.now() + 1000 * 60 * 30).toISOString(), // 30 minutes from now
      requestedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
      requestedBy: 'Project Manager Agent',
      chatId: chatId || 'default',
      status: 'pending'
    },
    {
      id: 'approval_003',
      taskId: 'task_approval_003',
      taskName: 'LinkedIn Post',
      taskDescription: 'Share company milestone on LinkedIn',
      taskType: 'post',
      priority: 'low',
      draftContent: 'Excited to announce that our AI agent platform has processed over 10,000 tasks this month! 🎉 Thank you to our amazing users for trusting us with their automation needs. Here\'s to the future of intelligent task management! #Milestone #AI #Automation',
      requestedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
      requestedBy: 'Social Media Agent',
      chatId: chatId || 'default',
      status: 'approved',
      approvedBy: 'admin',
      approvalNotes: 'Great content, approved for posting',
      approvalDecidedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
    }
  ];

  // Mock data for development
  const getMockTasks = (): SelfCreatedTask[] => [
    {
      id: 'task_001',
      name: 'Bitcoin Price Analysis',
      description: 'Analyze Bitcoin price trends and create report',
      status: 'completed',
      priority: 'high',
      scheduledTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      startedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      result: {
        success: true,
        data: {
          report: 'Bitcoin has shown strong upward momentum with a 15% increase over the past week. Key resistance level at $45,000 was broken, suggesting continued bullish sentiment. Trading volume has increased by 40% indicating strong market interest.',
          priceChange: '+15.2%',
          currentPrice: '$46,250',
          recommendation: 'Hold position, monitor for continuation'
        },
        duration: 300000 // 5 minutes
      },
      metadata: {
        source: 'user_input',
        originalMessage: 'I need you to search for current Bitcoin price trends and then create a reminder to check again in 2 minutes to see if there are any significant changes.',
        intent: 'market_analysis',
        complexity: 7
      }
    },
    {
      id: 'task_002',
      name: 'Reddit Language Barriers Research',
      description: 'Research language barriers in r/travel and create comprehensive report',
      status: 'in_progress',
      priority: 'medium',
      scheduledTime: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 mins from now
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      startedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      metadata: {
        source: 'user_input',
        originalMessage: 'Please do market research on the term "language barriers" in subreddit "travel" and present a report in 15 min',
        intent: 'research_task',
        complexity: 8
      }
    },
    {
      id: 'task_003',
      name: 'Weekly Marketing Review',
      description: 'Comprehensive review of marketing performance and metrics',
      status: 'pending',
      priority: 'low',
      scheduledTime: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), // 2 hours from now
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      metadata: {
        source: 'recurring_task',
        originalMessage: 'Generate weekly marketing review',
        intent: 'reporting',
        complexity: 5
      }
    },
    {
      id: 'task_004',
      name: 'API Documentation Update',
      description: 'Update API documentation with latest changes',
      status: 'failed',
      priority: 'medium',
      scheduledTime: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      startedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      result: {
        success: false,
        error: 'Failed to access documentation repository - authentication error',
        duration: 300000
      },
      metadata: {
        source: 'automated_task',
        originalMessage: 'Update documentation',
        intent: 'maintenance',
        complexity: 4
      }
    }
  ];

  // Filter and sort tasks
  const getFilteredAndSortedTasks = () => {
    let filtered = selfCreatedTasks;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'scheduledTime':
          aValue = new Date(a.scheduledTime).getTime();
          bValue = new Date(b.scheduledTime).getTime();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        default:
          return 0;
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
    
    return filtered;
  };

  // Debug logging for task data
  useEffect(() => {
    console.log('TasksTab rendered with tasks:', scheduledTasks);
    console.log('Number of tasks:', scheduledTasks?.length || 0);
    if (scheduledTasks && scheduledTasks.length > 0) {
      console.log('Sample task data:', JSON.stringify(scheduledTasks[0]));
    }
  }, [scheduledTasks]);

  // Load self-created tasks when tab becomes active
  useEffect(() => {
    if (activeTab === 'tasks') {
      fetchSelfCreatedTasks();
    }
  }, [activeTab]);

  // Refresh tasks when status filter changes
  useEffect(() => {
    if (activeTab === 'tasks') {
      fetchSelfCreatedTasks();
    }
  }, [statusFilter, activeTab]);

  // Load approval requests when tab becomes active
  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchApprovalRequests();
    }
  }, [activeTab]);

  // Refresh approvals when status filter changes
  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchApprovalRequests();
    }
  }, [approvalStatusFilter, activeTab]);

  // Function to handle manual refresh
  const handleManualRefresh = () => {
    setRefreshing(true);
    setManualRefreshCount(prev => prev + 1);
    
    if (activeTab === 'tasks') {
      fetchSelfCreatedTasks();
    } else if (activeTab === 'approvals') {
      fetchApprovalRequests();
    }
    
    // The page component will handle the actual refresh when it detects the page reload
    setTimeout(() => {
      if (activeTab === 'scheduled') {
        window.location.reload();
      }
      setRefreshing(false);
    }, 500);
  };

  // Debug function to fix scheduler
  const debugScheduler = async () => {
    setIsDebugging(true);
    try {
      // Add a timeout to the fetch request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

      const res = await fetch('/api/debug-scheduler', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      setDebugResult(data);
      console.log('Debug result:', data);
      
      // If tasks are available in the debug result, use them immediately
      if (data.tasks && data.tasks.length > 0) {
        setLocalTasks(data.tasks);
      }
      
      // Reload the page after a short delay to see the changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Debug error:', error);
      setDebugResult({ 
        error: error instanceof Error ? error.message : String(error),
        tip: "This could be due to a server timeout. Try increasing your network timeout settings."
      });
    } finally {
      setIsDebugging(false);
    }
  };

  // Debug function to fix reflections
  const fixReflections = async () => {
    setIsDebugging(true);
    try {
      // Add a timeout to the fetch request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

      const res = await fetch('/api/fix-reflections', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      setDebugResult(data);
      console.log('Fix reflections result:', data);
    } catch (error) {
      console.error('Fix reflections error:', error);
      setDebugResult({ 
        error: error instanceof Error ? error.message : String(error),
        tip: "This could be due to a server timeout. Try increasing your network timeout settings."
      });
    } finally {
      setIsDebugging(false);
    }
  };
  
  // Local state for tasks as a fallback
  const [localTasks, setLocalTasks] = useState<ScheduledTask[]>([]);
  
  // Use local tasks if scheduledTasks is empty
  const displayTasks = scheduledTasks?.length > 0 ? scheduledTasks : localTasks;
  
  // Initialize local task data for preview/testing
  useEffect(() => {
    if (!scheduledTasks || scheduledTasks.length === 0) {
      // If no tasks are loaded, set some default tasks for UI preview
      setLocalTasks([
        {
          id: TASK_IDS.MARKET_SCAN,
          name: 'Market Scanner',
          description: 'Scan for market trends, news, and insights',
          cronExpression: '0 7,15 * * *',
          enabled: true,
          lastRun: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
          nextRun: new Date(Date.now() + 1000 * 60 * 60 * 9).toISOString()
        },
        {
          id: TASK_IDS.DAILY_PLANNING,
          name: 'Daily Planning',
          description: 'Create a daily plan for marketing tasks',
          cronExpression: '0 8 * * *',
          enabled: true,
          lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          nextRun: new Date(Date.now() + 1000 * 60 * 60 * 16).toISOString()
        },
        {
          id: TASK_IDS.WEEKLY_MARKETING_REVIEW,
          name: 'Weekly Reflection',
          description: 'Reflect on weekly performance and achievements',
          cronExpression: '0 18 * * 0',
          enabled: true,
          lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
          nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString()
        }
      ]);
    }
  }, [scheduledTasks]);

  // Track if this is the first load
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  useEffect(() => {
    // After the component mounts, set isFirstLoad to false after a delay
    // This helps us identify the initial load vs subsequent loads
    const timer = setTimeout(() => {
      setIsFirstLoad(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Render task result modal
  const renderTaskResultModal = () => {
    if (!selectedTaskResult) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedTaskResult.name}</h2>
                <p className="text-gray-400 mt-1">{selectedTaskResult.description}</p>
              </div>
              <button 
                onClick={() => setSelectedTaskResult(null)}
                className="text-gray-400 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            {/* Task details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Task Details</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-400">Status:</span> <span className={getStatusDisplay(selectedTaskResult.status).bg + ' px-2 py-1 rounded-full text-xs'}>{selectedTaskResult.status}</span></div>
                  <div><span className="text-gray-400">Priority:</span> <span className={getPriorityDisplay(selectedTaskResult.priority).color + ' px-2 py-1 rounded text-xs'}>{getPriorityDisplay(selectedTaskResult.priority).label}</span></div>
                  <div><span className="text-gray-400">Created:</span> <span className="text-white">{formatDate(selectedTaskResult.createdAt)}</span></div>
                  <div><span className="text-gray-400">Scheduled:</span> <span className="text-white">{formatDate(selectedTaskResult.scheduledTime)}</span></div>
                  {selectedTaskResult.startedAt && (
                    <div><span className="text-gray-400">Started:</span> <span className="text-white">{formatDate(selectedTaskResult.startedAt)}</span></div>
                  )}
                  {selectedTaskResult.completedAt && (
                    <div><span className="text-gray-400">Completed:</span> <span className="text-white">{formatDate(selectedTaskResult.completedAt)}</span></div>
                  )}
                  {selectedTaskResult.result?.duration && (
                    <div><span className="text-gray-400">Duration:</span> <span className="text-white">{Math.round(selectedTaskResult.result.duration / 1000)}s</span></div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Metadata</h3>
                <div className="space-y-2 text-sm">
                  {selectedTaskResult.metadata?.source && (
                    <div><span className="text-gray-400">Source:</span> <span className="text-white">{selectedTaskResult.metadata.source}</span></div>
                  )}
                  {selectedTaskResult.metadata?.intent && (
                    <div><span className="text-gray-400">Intent:</span> <span className="text-white">{selectedTaskResult.metadata.intent}</span></div>
                  )}
                  {selectedTaskResult.metadata?.complexity && (
                    <div><span className="text-gray-400">Complexity:</span> <span className="text-white">{selectedTaskResult.metadata.complexity}/10</span></div>
                  )}
                  {selectedTaskResult.metadata?.originalMessage && (
                    <div>
                      <span className="text-gray-400">Original Request:</span>
                      <div className="text-white bg-gray-700 p-2 rounded mt-1 text-xs">{selectedTaskResult.metadata.originalMessage}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Task result */}
            {selectedTaskResult.result && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {selectedTaskResult.result.success ? '✅ Task Result' : '❌ Task Failed'}
                </h3>
                {selectedTaskResult.result.success ? (
                  <div className="bg-gray-700 p-4 rounded">
                    {selectedTaskResult.result.data && (
                      <div className="space-y-3">
                        {typeof selectedTaskResult.result.data === 'string' ? (
                          <pre className="text-green-400 whitespace-pre-wrap text-sm">{selectedTaskResult.result.data}</pre>
                        ) : (
                          <div className="space-y-2">
                            {selectedTaskResult.result.data.report && (
                              <div>
                                <h4 className="text-white font-medium mb-1">Report:</h4>
                                <p className="text-green-400 text-sm">{selectedTaskResult.result.data.report}</p>
                              </div>
                            )}
                            {Object.entries(selectedTaskResult.result.data).filter(([key]) => key !== 'report').map(([key, value]) => (
                              <div key={key}>
                                <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                <span className="text-white ml-2">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-900/30 border border-red-700 p-4 rounded">
                    <p className="text-red-400">{selectedTaskResult.result.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-700 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'scheduled'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600'
          }`}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Scheduled Tasks
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'tasks'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600'
          }`}
        >
          <ListTodo className="h-4 w-4 mr-2" />
          Task Board
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'approvals'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600'
          }`}
        >
          <UserCheck className="h-4 w-4 mr-2" />
          Approvals
          {approvalRequests.filter(req => req.status === 'pending').length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {approvalRequests.filter(req => req.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Scheduled Tasks Tab */}
      {activeTab === 'scheduled' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Scheduled Tasks</h2>
          
          {/* Debug buttons */}
          <div className="mb-4 flex space-x-2">
            <button 
              onClick={handleManualRefresh} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md flex items-center text-sm"
              disabled={refreshing || isDebugging}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button 
              onClick={debugScheduler} 
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-md flex items-center text-sm"
              disabled={isDebugging || refreshing}
            >
              <BugIcon className="h-4 w-4 mr-1" /> Debug Scheduler
            </button>
            <button 
              onClick={fixReflections} 
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md flex items-center text-sm"
              disabled={isDebugging || refreshing}
            >
              <WrenchIcon className="h-4 w-4 mr-1" /> Fix Reflections
            </button>
          </div>
          
          {/* Debug result display */}
          {debugResult && (
            <div className="mb-4 p-3 bg-gray-900 rounded text-xs max-h-40 overflow-auto border border-gray-700">
              <h3 className="text-sm font-medium mb-1 text-blue-400">Debug Results</h3>
              {debugResult.error ? (
                <div>
                  <p className="text-red-400">{debugResult.error}</p>
                  {debugResult.tip && <p className="text-yellow-400 mt-1">{debugResult.tip}</p>}
                </div>
              ) : (
                <pre className="text-green-400">{JSON.stringify(debugResult, null, 2)}</pre>
              )}
            </div>
          )}
          
          {/* Debug information */}
          <div className="mb-4 p-2 bg-gray-900 rounded text-xs">
            <p>Task count: {scheduledTasks?.length || 0}</p>
            <p>Loading state: {isLoadingTasks ? 'Loading' : 'Ready'}</p>
            {manualRefreshCount > 0 && <p>Refresh count: {manualRefreshCount}</p>}
            {isFirstLoad && scheduledTasks && scheduledTasks.length === 1 && scheduledTasks[0].id === 'error' && (
              <p className="text-yellow-400 mt-1">First load often fails. Try refreshing with the button above.</p>
            )}
          </div>
          
          {isDebugging && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500"></div>
              <span className="ml-2">Running debug tool...</span>
            </div>
          )}
          
          {refreshing && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-2">Refreshing...</span>
            </div>
          )}
          
          {isLoadingTasks ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-2">Loading tasks...</span>
            </div>
          ) : !displayTasks || displayTasks.length === 0 ? (
            <p className="text-gray-400">No scheduled tasks found.</p>
          ) : displayTasks.length === 1 && displayTasks[0].id === 'error' ? (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded">
              <h3 className="text-lg font-semibold text-red-400 mb-2">{displayTasks[0].name}</h3>
              <p className="text-sm text-gray-300">{displayTasks[0].description}</p>
              <p className="text-xs text-gray-400 mt-2">
                This error may be temporary. Try using the refresh button above or check server logs for more information.
              </p>
              <div className="mt-3 flex space-x-2">
                <button 
                  onClick={handleManualRefresh}
                  className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded-md flex items-center text-sm"
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Try Again
                </button>
                <button 
                  onClick={debugScheduler}
                  className="bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1 rounded-md flex items-center text-sm"
                >
                  <BugIcon className="h-4 w-4 mr-1" /> Debug Issues
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Schedule</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Run</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Next Run</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {displayTasks.map((task) => (
                    <tr key={task.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-2">
                          <span>{cleanTaskName(task.name)}</span>
                          {task.enabled && (
                            <span className="px-2 py-0.5 text-xs leading-5 font-semibold rounded-full bg-blue-800 text-blue-100">
                              Autonomous
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{task.description || 'No description'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{formatCronExpression(task.cronExpression || '* * * * *')}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{formatDate(task.lastRun)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{formatDate(task.nextRun)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${task.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {task.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => runTaskNow(task.id)}
                            className="text-blue-400 hover:text-blue-300"
                            title="Run now"
                          >
                            <PlayIcon className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={() => toggleTaskEnabled(task.id, !task.enabled)}
                            className={`${task.enabled ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                            title={task.enabled ? 'Disable' : 'Enable'}
                          >
                            {task.enabled ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Task Board Tab */}
      {activeTab === 'tasks' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Task Board</h2>
            <div className="flex items-center space-x-4">
              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-700 text-white text-sm rounded-md px-2 py-1 border border-gray-600"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              
              {/* Sort Controls */}
              <div className="flex items-center space-x-2">
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-gray-700 text-white text-sm rounded-md px-2 py-1 border border-gray-600"
                >
                  <option value="scheduledTime">Scheduled Time</option>
                  <option value="createdAt">Created</option>
                  <option value="priority">Priority</option>
                </select>
                <button 
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="text-gray-400 hover:text-white"
                >
                  {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Refresh Button */}
              <button 
                onClick={handleManualRefresh} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md flex items-center text-sm"
                disabled={refreshing || isLoadingTaskBoard}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing || isLoadingTaskBoard ? 'animate-spin' : ''}`} /> 
                Refresh
              </button>
            </div>
          </div>
          
          {/* Task Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {['pending', 'in_progress', 'completed', 'failed'].map(status => {
              const count = selfCreatedTasks.filter(task => task.status === status).length;
              const { color } = getStatusDisplay(status as any);
              return (
                <div key={status} className="bg-gray-700 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 capitalize">{status.replace('_', ' ')}</span>
                    <span className={`text-lg font-bold ${color}`}>{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {isLoadingTaskBoard ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-2">Loading task board...</span>
            </div>
          ) : getFilteredAndSortedTasks().length === 0 ? (
            <div className="text-center py-8">
              <ListTodo className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No tasks found matching your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Task</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Priority</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Scheduled</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {getFilteredAndSortedTasks().map((task) => {
                    const statusDisplay = getStatusDisplay(task.status);
                    const priorityDisplay = getPriorityDisplay(task.priority);
                    const StatusIcon = statusDisplay.icon;
                    
                    return (
                      <tr key={task.id} className="hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-white">{task.name}</div>
                            <div className="text-sm text-gray-400">{task.description}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <StatusIcon className={`h-4 w-4 mr-2 ${statusDisplay.color}`} />
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusDisplay.bg}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${priorityDisplay.color}`}>
                            {priorityDisplay.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div>
                            <div className="text-white">{formatRelativeTime(task.scheduledTime)}</div>
                            <div className="text-gray-400 text-xs">{formatDate(task.scheduledTime)}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                          {task.result?.duration ? `${Math.round(task.result.duration / 1000)}s` : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex space-x-2">
                            {(task.status === 'completed' || task.status === 'failed') && (
                              <button 
                                onClick={() => setSelectedTaskResult(task)}
                                className="text-blue-400 hover:text-blue-300"
                                title="View result"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                            {task.status === 'failed' && (
                              <button 
                                onClick={() => {/* TODO: Retry task */}}
                                className="text-yellow-400 hover:text-yellow-300"
                                title="Retry task"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Approval Requests</h2>
            <div className="flex items-center space-x-4">
              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select 
                  value={approvalStatusFilter} 
                  onChange={(e) => setApprovalStatusFilter(e.target.value)}
                  className="bg-gray-700 text-white text-sm rounded-md px-2 py-1 border border-gray-600"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              {/* Refresh Button */}
              <button 
                onClick={handleManualRefresh} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md flex items-center text-sm"
                disabled={refreshing || isLoadingApprovals}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing || isLoadingApprovals ? 'animate-spin' : ''}`} /> 
                Refresh
              </button>
            </div>
          </div>
          
          {/* Approval Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {['pending', 'approved', 'rejected'].map(status => {
              const count = approvalRequests.filter(request => request.status === status).length;
              const colors = {
                pending: 'text-yellow-400',
                approved: 'text-green-400',
                rejected: 'text-red-400'
              };
              return (
                <div key={status} className="bg-gray-700 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 capitalize">{status}</span>
                    <span className={`text-lg font-bold ${colors[status as keyof typeof colors]}`}>{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {isLoadingApprovals ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-2">Loading approval requests...</span>
            </div>
          ) : approvalRequests.filter(req => approvalStatusFilter === 'all' || req.status === approvalStatusFilter).length === 0 ? (
            <div className="text-center py-8">
              <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No approval requests found matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvalRequests
                .filter(req => approvalStatusFilter === 'all' || req.status === approvalStatusFilter)
                .map((request) => {
                  const priorityColors = {
                    urgent: 'bg-red-500 text-white',
                    high: 'bg-orange-500 text-white',
                    medium: 'bg-yellow-500 text-white',
                    low: 'bg-green-500 text-white'
                  };
                  
                  const statusColors = {
                    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  };
                  
                  return (
                    <div key={request.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-white">{request.taskName}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${priorityColors[request.priority as keyof typeof priorityColors]}`}>
                              {request.priority.toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[request.status as keyof typeof statusColors]}`}>
                              {request.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm mb-2">{request.taskDescription}</p>
                          <div className="text-xs text-gray-400">
                            <span>Requested by {request.requestedBy} • {formatRelativeTime(request.requestedAt)}</span>
                            {request.scheduledTime && (
                              <span> • Scheduled for {formatDate(request.scheduledTime)}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-gray-400" />
                          <span className="text-xs text-gray-400">{request.taskType}</span>
                        </div>
                      </div>
                      
                      {request.draftContent && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-300 mb-1">Content Preview:</h4>
                          <div className="bg-gray-800 p-2 rounded border border-gray-600 text-sm text-gray-300 max-h-32 overflow-y-auto">
                            {request.draftContent.length > 300 
                              ? `${request.draftContent.substring(0, 300)}...`
                              : request.draftContent
                            }
                          </div>
                        </div>
                      )}
                      
                      {request.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedApprovalRequest(request)}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm flex items-center"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Review
                          </button>
                          <button
                            onClick={() => handleApprovalDecision(false, request.taskId)}
                            disabled={isProcessingApproval}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center disabled:opacity-50"
                          >
                            <ThumbsDown className="h-3 w-3 mr-1" />
                            Reject
                          </button>
                          <button
                            onClick={() => handleApprovalDecision(true, request.taskId)}
                            disabled={isProcessingApproval}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center disabled:opacity-50"
                          >
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            Approve
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 text-right">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'} by {request.approvedBy} • {formatRelativeTime(request.approvalDecidedAt || '')}
                          {request.approvalNotes && (
                            <div className="mt-1 text-gray-300">Notes: {request.approvalNotes}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
      
      {/* Task Result Modal */}
      {renderTaskResultModal()}
      
      {/* Approval Detail Modal */}
      {selectedApprovalRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedApprovalRequest.taskName}</h2>
                  <p className="text-gray-400 mt-1">{selectedApprovalRequest.taskDescription}</p>
                </div>
                <button 
                  onClick={() => setSelectedApprovalRequest(null)}
                  className="text-gray-400 hover:text-white text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              {/* Request details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Request Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-400">Type:</span> <span className="text-white">{selectedApprovalRequest.taskType}</span></div>
                    <div><span className="text-gray-400">Priority:</span> <span className="text-white">{selectedApprovalRequest.priority}</span></div>
                    <div><span className="text-gray-400">Requested by:</span> <span className="text-white">{selectedApprovalRequest.requestedBy}</span></div>
                    <div><span className="text-gray-400">Requested:</span> <span className="text-white">{formatDate(selectedApprovalRequest.requestedAt)}</span></div>
                    {selectedApprovalRequest.scheduledTime && (
                      <div><span className="text-gray-400">Scheduled for:</span> <span className="text-white">{formatDate(selectedApprovalRequest.scheduledTime)}</span></div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Status</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-400">Current Status:</span> <span className="text-white capitalize">{selectedApprovalRequest.status}</span></div>
                    <div><span className="text-gray-400">Task ID:</span> <span className="text-white font-mono text-xs">{selectedApprovalRequest.taskId}</span></div>
                    <div><span className="text-gray-400">Chat ID:</span> <span className="text-white font-mono text-xs">{selectedApprovalRequest.chatId}</span></div>
                  </div>
                </div>
              </div>
              
              {/* Content preview */}
              {selectedApprovalRequest.draftContent && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Content to be Published</h3>
                  <div className="bg-gray-700 p-4 rounded border border-gray-600">
                    <pre className="text-green-400 whitespace-pre-wrap text-sm">{selectedApprovalRequest.draftContent}</pre>
                  </div>
                </div>
              )}
              
              {/* Approval notes input */}
              {selectedApprovalRequest.status === 'pending' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-white mb-2">
                    Approval Notes (optional):
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="w-full p-2 text-sm bg-gray-700 border border-gray-600 rounded resize-none text-white"
                    rows={3}
                    placeholder="Add any notes about your decision..."
                  />
                </div>
              )}
              
              {/* Action buttons */}
              {selectedApprovalRequest.status === 'pending' ? (
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedApprovalRequest(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApprovalDecision(false, selectedApprovalRequest.taskId, approvalNotes || undefined)}
                    disabled={isProcessingApproval}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {isProcessingApproval ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <ThumbsDown className="h-4 w-4 mr-2" />
                    )}
                    Reject Task
                  </button>
                  <button
                    onClick={() => handleApprovalDecision(true, selectedApprovalRequest.taskId, approvalNotes || undefined)}
                    disabled={isProcessingApproval}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {isProcessingApproval ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <ThumbsUp className="h-4 w-4 mr-2" />
                    )}
                    Approve & Schedule
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400">
                    This request has already been {selectedApprovalRequest.status}.
                  </p>
                  {selectedApprovalRequest.approvalNotes && (
                    <div className="mt-2">
                      <span className="text-gray-400">Notes: </span>
                      <span className="text-white">{selectedApprovalRequest.approvalNotes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksTab; 