import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface DeleteAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
  agentName?: string;
}

const DeleteAgentDialog: React.FC<DeleteAgentDialogProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  agentName = 'this agent'
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  if (!isOpen) return null;
  
  const handleInitiateDelete = () => {
    setShowConfirmation(true);
  };
  
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };
  
  const handleConfirmDelete = () => {
    onConfirmDelete();
    setShowConfirmation(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            {showConfirmation ? "Confirm Deletion" : "Agent Settings"}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {!showConfirmation ? (
          <>
            <div className="mb-6 text-gray-300">
              <p className="mb-4">Manage your agent settings or delete this agent.</p>
              
              {/* Settings options could go here */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="text-lg font-medium text-white mb-2">Danger Zone</h3>
                <p className="text-gray-400 mb-4">
                  Deleting an agent will permanently remove all associated data, including chat history, memory, and custom configurations.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateDelete}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white flex items-center"
              >
                Delete Agent
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center mb-4 text-yellow-400">
                <AlertTriangle className="h-6 w-6 mr-2" />
                <h3 className="text-lg font-medium">This action cannot be undone</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Are you sure you want to permanently delete {agentName}? This will remove:
              </p>
              <ul className="list-disc pl-5 text-gray-400 mb-4">
                <li>All chat history</li>
                <li>Agent memories and knowledge</li>
                <li>Custom configuration and capabilities</li>
              </ul>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelConfirmation}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white flex items-center"
              >
                Permanently Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DeleteAgentDialog; 