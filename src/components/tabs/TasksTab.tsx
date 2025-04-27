import React from 'react';
import { ScheduledTask } from '../../types';
import { PlayIcon, PauseIcon } from 'lucide-react';

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
  // Function to clean task names by removing department names in braces
  const cleanTaskName = (name: string) => {
    return name.replace(/\s*\([^)]*\)\s*/g, '');
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Scheduled Tasks</h2>
      {isLoadingTasks ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : scheduledTasks.length === 0 ? (
        <p className="text-gray-400">No scheduled tasks found.</p>
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
            <tbody className="divide-y divide-gray-700">
              {scheduledTasks.map((task) => (
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
                  <td className="px-4 py-3 text-sm">{task.description}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{formatCronExpression(task.cronExpression)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{task.lastRun ? new Date(task.lastRun).toLocaleString() : 'Never'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{task.nextRun ? new Date(task.nextRun).toLocaleString() : 'Unknown'}</td>
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