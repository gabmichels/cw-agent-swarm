import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AgentSettingsProps {
  agentId: string;
  agentName?: string;
}

/**
 * Agent settings component with delete functionality
 */
const AgentSettings: React.FC<AgentSettingsProps> = ({
  agentId,
  agentName = 'this agent'
}) => {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const openDeleteModal = () => {
    setIsDeleteModalOpen(true);
  };
  
  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };
  
  const handleDeleteAgent = async () => {
    try {
      setIsDeleting(true);
      
      // Call the delete API endpoint
      const response = await fetch(`/api/multi-agent/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete agent');
      }
      
      // Close the modal
      setIsDeleteModalOpen(false);
      
      // Navigate back to the agents list
      router.push('/agents');
      router.refresh();
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert(`Failed to delete agent: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <>
      {/* Settings icon button */}
      <div className="agent-settings-icon" onClick={openDeleteModal}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </div>
      
      {/* Delete confirmation modal */}
      {isDeleteModalOpen && (
        <div className="agent-delete-modal-backdrop">
          <div className="agent-delete-modal">
            <h3>Delete Agent</h3>
            <p>Are you sure you want to delete {agentName}? This action cannot be undone.</p>
            
            <div className="agent-delete-modal-buttons">
              <button 
                className="agent-delete-modal-cancel" 
                onClick={closeDeleteModal}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="agent-delete-modal-confirm" 
                onClick={handleDeleteAgent}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .agent-settings-icon {
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .agent-settings-icon:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        
        .agent-delete-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .agent-delete-modal {
          background-color: var(--background);
          border-radius: 8px;
          padding: 24px;
          width: 400px;
          max-width: 90%;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
        }
        
        .agent-delete-modal h3 {
          margin-top: 0;
          color: var(--foreground);
        }
        
        .agent-delete-modal p {
          margin-bottom: 24px;
          color: var(--foreground-secondary);
        }
        
        .agent-delete-modal-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 16px;
        }
        
        .agent-delete-modal-cancel {
          padding: 8px 16px;
          border-radius: 4px;
          border: 1px solid var(--border);
          background-color: transparent;
          color: var(--foreground);
          cursor: pointer;
        }
        
        .agent-delete-modal-confirm {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          background-color: var(--error);
          color: white;
          cursor: pointer;
        }
        
        .agent-delete-modal-cancel:disabled,
        .agent-delete-modal-confirm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
};

export default AgentSettings; 