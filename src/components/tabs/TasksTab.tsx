import React, { useEffect, useState } from 'react';
import { ScheduledTask } from '../../types';
import { PlayIcon, PauseIcon, RefreshCw, WrenchIcon, BugIcon } from 'lucide-react';
import { TASK_IDS } from '../../lib/shared/constants';

interface TasksTabProps {
  isLoadingTasks: boolean;
  scheduledTasks: ScheduledTask[];
  runTaskNow: (taskId: string) => Promise<void>;
  toggleTaskEnabled: (taskId: string, enabled: boolean) => Promise<void>;
  formatCronExpression: (cronExp: string) => string;
}

const TasksTab: React.FC<TasksTabProps> = ({
  isLoadingTasks,
  scheduledTasks,
  runTaskNow,
  toggleTaskEnabled,
  formatCronExpression,
}) => {
  const [debugResult, setDebugResult] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefreshCount, setManualRefreshCount] = useState(0);

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

  // Debug logging for task data
  useEffect(() => {
    console.log('TasksTab rendered with tasks:', scheduledTasks);
    console.log('Number of tasks:', scheduledTasks?.length || 0);
    if (scheduledTasks && scheduledTasks.length > 0) {
      console.log('Sample task data:', JSON.stringify(scheduledTasks[0]));
    }
  }, [scheduledTasks]);

  // Function to handle manual refresh
  const handleManualRefresh = () => {
    setRefreshing(true);
    setManualRefreshCount(prev => prev + 1);
    // The page component will handle the actual refresh when it detects the page reload
    setTimeout(() => {
      window.location.reload();
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

  return (
    <div className="bg-gray-800 rounded-lg p-4">
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
  );
};

export default TasksTab; 