'use client';

import React, { useState, useCallback } from 'react';
import { OrgChartChange } from './OrgChartRenderer';

export interface PlanningModeControlsProps {
  isActive: boolean;
  pendingChanges: OrgChartChange[];
  onTogglePlanningMode: () => void;
  onApplyChanges: () => Promise<void>;
  onDiscardChanges: () => void;
  onUndoChange: (changeId: string) => void;
  onRedoChange: (changeId: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  isApplying: boolean;
  onCreateAgent?: () => void;
  draftAgentCount?: number;
  onClearDrafts?: () => void;
}

export const PlanningModeControls: React.FC<PlanningModeControlsProps> = ({
  isActive,
  pendingChanges,
  onTogglePlanningMode,
  onApplyChanges,
  onDiscardChanges,
  onUndoChange,
  onRedoChange,
  canUndo,
  canRedo,
  isApplying,
  onCreateAgent,
  draftAgentCount = 0,
  onClearDrafts
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'apply' | 'discard' | null>(null);

  const handleApplyChanges = useCallback(() => {
    if (pendingChanges.length === 0) return;
    setConfirmAction('apply');
    setShowConfirmDialog(true);
  }, [pendingChanges.length]);

  const handleDiscardChanges = useCallback(() => {
    if (pendingChanges.length === 0) return;
    setConfirmAction('discard');
    setShowConfirmDialog(true);
  }, [pendingChanges.length]);

  const handleConfirm = useCallback(async () => {
    if (confirmAction === 'apply') {
      await onApplyChanges();
    } else if (confirmAction === 'discard') {
      onDiscardChanges();
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, [confirmAction, onApplyChanges, onDiscardChanges]);

  const handleCancel = useCallback(() => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, []);

  const getChangeDescription = (change: OrgChartChange): string => {
    switch (change.type) {
      case 'agent_move':
        return `Move agent ${change.agentId} to new position`;
      case 'agent_reassign':
        return `Reassign agent ${change.agentId} to department ${change.newDepartmentId}`;
      case 'department_create':
        return `Create new department at position (${change.newPosition?.x}, ${change.newPosition?.y})`;
      default:
        return 'Unknown change';
    }
  };

  return (
    <div className="planning-mode-controls">
      <style jsx>{`
        .planning-mode-controls {
          position: fixed;
          top: 80px;
          right: 20px;
          background: #1f2937;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          padding: 16px;
          min-width: 300px;
          max-width: 400px;
          z-index: 1000;
          border: 1px solid #374151;
        }

        .controls-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }

        .mode-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: bold;
          color: #f9fafb;
        }

        .mode-status {
          padding: 4px 8px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }

        .mode-status.active {
          background: #fff3cd;
          color: #856404;
        }

        .mode-status.inactive {
          background: #d1ecf1;
          color: #0c5460;
        }

        .toggle-button {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .toggle-button.activate {
          background: #ff9800;
          color: white;
        }

        .toggle-button.activate:hover {
          background: #f57c00;
        }

        .toggle-button.deactivate {
          background: #6c757d;
          color: white;
        }

        .toggle-button.deactivate:hover {
          background: #5a6268;
        }

        .changes-section {
          margin-bottom: 16px;
        }

        .changes-header {
          font-size: 14px;
          font-weight: 600;
          color: #f9fafb;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .changes-count {
          background: #007bff;
          color: white;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 500;
        }

        .changes-list {
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid #4b5563;
          border-radius: 6px;
          background: #374151;
        }

        .change-item {
          padding: 8px 12px;
          border-bottom: 1px solid #4b5563;
          font-size: 13px;
          color: #d1d5db;
        }

        .change-item:last-child {
          border-bottom: none;
        }

        .no-changes {
          padding: 16px;
          text-align: center;
          color: #9ca3af;
          font-size: 13px;
          font-style: italic;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .action-button {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-button.apply {
          background: #28a745;
          color: white;
        }

        .action-button.apply:hover:not(:disabled) {
          background: #218838;
        }

        .action-button.discard {
          background: #dc3545;
          color: white;
        }

        .action-button.discard:hover:not(:disabled) {
          background: #c82333;
        }

        .undo-redo-buttons {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
        }

        .undo-redo-button {
          padding: 6px 12px;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          background: white;
          color: #495057;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .undo-redo-button:hover:not(:disabled) {
          background: #f8f9fa;
          border-color: #adb5bd;
        }

        .undo-redo-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .confirmation-dialog {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .dialog-content {
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .dialog-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          margin-bottom: 12px;
        }

        .dialog-message {
          color: #666;
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .dialog-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .dialog-button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .dialog-button.primary {
          background: #007bff;
          color: white;
        }

        .dialog-button.primary:hover {
          background: #0056b3;
        }

        .dialog-button.secondary {
          background: #6c757d;
          color: white;
        }

        .dialog-button.secondary:hover {
          background: #5a6268;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .help-text {
          font-size: 12px;
          color: #6c757d;
          margin-top: 12px;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 4px;
          border-left: 3px solid #007bff;
        }

        .create-section {
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #4b5563;
        }

        .create-button {
          width: 100%;
          padding: 12px 16px;
          border: 2px dashed #10b981;
          border-radius: 8px;
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .create-button:hover {
          background: rgba(16, 185, 129, 0.2);
          border-color: #059669;
        }

        .create-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div className="controls-header">
        <div className="mode-indicator">
          <span>Planning Mode</span>
          <span className={`mode-status ${isActive ? 'active' : 'inactive'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <button
          className={`toggle-button ${isActive ? 'deactivate' : 'activate'}`}
          onClick={onTogglePlanningMode}
          disabled={isApplying}
        >
          {isActive ? 'Exit Planning' : 'Enter Planning'}
        </button>
      </div>

      {isActive && (
        <>
          <div className="create-section">
            <button
              className="create-button"
              onClick={onCreateAgent}
              disabled={isApplying || !onCreateAgent}
              title="Create a new draft agent"
            >
              ➕ Create New Agent
            </button>
            
            {draftAgentCount > 0 && (
              <div style={{ 
                marginTop: '8px', 
                fontSize: '12px', 
                color: '#d1d5db',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>📝 {draftAgentCount} draft agent{draftAgentCount !== 1 ? 's' : ''}</span>
                {onClearDrafts && (
                  <button
                    onClick={() => {
                      if (confirm(`Clear all ${draftAgentCount} draft agents? This cannot be undone.`)) {
                        onClearDrafts();
                      }
                    }}
                    disabled={isApplying}
                    style={{
                      background: 'transparent',
                      border: '1px solid #6b7280',
                      color: '#9ca3af',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                    title="Clear all draft agents"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="undo-redo-buttons">
            <button
              className="undo-redo-button"
              onClick={() => onUndoChange('last')}
              disabled={!canUndo || isApplying}
              title="Undo last change"
            >
              ↶ Undo
            </button>
            <button
              className="undo-redo-button"
              onClick={() => onRedoChange('next')}
              disabled={!canRedo || isApplying}
              title="Redo last undone change"
            >
              ↷ Redo
            </button>
          </div>

          <div className="changes-section">
            <div className="changes-header">
              <span>Pending Changes</span>
              {pendingChanges.length > 0 && (
                <span className="changes-count">{pendingChanges.length}</span>
              )}
            </div>

            {pendingChanges.length > 0 ? (
              <div className="changes-list">
                {pendingChanges.map((change, index) => (
                  <div key={index} className="change-item">
                    {getChangeDescription(change)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-changes">
                No changes made yet. Drag agents or departments to reorganize.
              </div>
            )}
          </div>

          <div className="action-buttons">
            <button
              className="action-button apply"
              onClick={handleApplyChanges}
              disabled={pendingChanges.length === 0 || isApplying}
            >
              {isApplying ? (
                <>
                  <div className="loading-spinner" />
                  Applying...
                </>
              ) : (
                <>
                  ✓ Apply Changes
                </>
              )}
            </button>
            <button
              className="action-button discard"
              onClick={handleDiscardChanges}
              disabled={pendingChanges.length === 0 || isApplying}
            >
              ✕ Discard
            </button>
          </div>

          <div className="help-text">
            💡 <strong>Tip:</strong> Drag agents between departments or drag departments to reorganize the hierarchy. 
            Changes are previewed in real-time and can be applied or discarded.
          </div>
        </>
      )}

      {showConfirmDialog && (
        <div className="confirmation-dialog">
          <div className="dialog-content">
            <div className="dialog-title">
              {confirmAction === 'apply' ? 'Apply Changes?' : 'Discard Changes?'}
            </div>
            <div className="dialog-message">
              {confirmAction === 'apply'
                ? `Are you sure you want to apply ${pendingChanges.length} change${pendingChanges.length !== 1 ? 's' : ''}? This action cannot be undone.`
                : `Are you sure you want to discard ${pendingChanges.length} pending change${pendingChanges.length !== 1 ? 's' : ''}? This action cannot be undone.`
              }
            </div>
            <div className="dialog-buttons">
              <button className="dialog-button secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button className="dialog-button primary" onClick={handleConfirm}>
                {confirmAction === 'apply' ? 'Apply' : 'Discard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanningModeControls; 