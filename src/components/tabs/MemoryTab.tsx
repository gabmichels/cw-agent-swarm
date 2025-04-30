import React, { useState } from 'react';
import { MemoryItem } from '../../types';
import { AlertCircleIcon } from 'lucide-react';

// Define types for the debug result
interface SuspectedMessage {
  id: string;
  text: string;
  timestamp: string;
}

interface DebugResult {
  status: string;
  message: string;
  totalMessages: number;
  suspectedReflectionCount: number;
  suspectedMessages: SuspectedMessage[];
  error?: string;
}

interface MemoryTabProps {
  isLoadingMemories: boolean;
  allMemories: MemoryItem[];
}

const MemoryTab: React.FC<MemoryTabProps> = ({
  isLoadingMemories,
  allMemories,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);

  const checkIncorrectReflections = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/cleanup-messages');
      const data = await res.json();
      setDebugResult(data);
      console.log('Found incorrect reflections:', data);
    } catch (error) {
      console.error('Error checking reflections:', error);
      setDebugResult({ 
        status: 'error', 
        message: error instanceof Error ? error.message : String(error),
        totalMessages: 0,
        suspectedReflectionCount: 0,
        suspectedMessages: []
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Memory Explorer</h2>
        
        <div className="flex space-x-2">
          <button 
            onClick={checkIncorrectReflections}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-md flex items-center text-sm"
            disabled={isChecking}
          >
            <AlertCircleIcon className="h-4 w-4 mr-1" /> Check Reflections
          </button>
        </div>
      </div>
      
      {/* Debug result display */}
      {debugResult && (
        <div className="mb-4 p-2 bg-gray-900 rounded text-xs max-h-40 overflow-auto">
          <p className="mb-2 font-bold">Debug Result:</p>
          <p>Status: {debugResult.status}</p>
          <p>Message: {debugResult.message}</p>
          <p>Total Messages: {debugResult.totalMessages}</p>
          <p>Suspected Reflections: {debugResult.suspectedReflectionCount}</p>
          
          {debugResult.suspectedMessages && debugResult.suspectedMessages.length > 0 && (
            <div className="mt-2">
              <p className="font-bold">Suspected Reflection Messages:</p>
              <ul className="list-disc pl-5">
                {debugResult.suspectedMessages.slice(0, 5).map((msg, idx) => (
                  <li key={idx} className="mt-1">
                    <span className="text-gray-400">{new Date(msg.timestamp).toLocaleString()}</span>: {msg.text}
                  </li>
                ))}
                {debugResult.suspectedMessages.length > 5 && (
                  <li className="mt-1">...and {debugResult.suspectedMessages.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {isChecking && (
        <div className="flex justify-center mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500"></div>
          <span className="ml-2">Checking for incorrect reflections...</span>
        </div>
      )}
      
      {isLoadingMemories ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : allMemories.length === 0 ? (
        <p className="text-gray-400">No memories found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Content</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tags</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {allMemories.map((memory, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 whitespace-normal text-sm max-w-xs overflow-hidden">
                    {memory.content || 'No content'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-800 text-blue-100">
                      {memory.category || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {memory.tags?.join(', ') || 'None'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {memory.created ? new Date(memory.created).toLocaleString() : 'Unknown'}
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

export default MemoryTab; 