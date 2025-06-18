'use client';

import React, { useState, useEffect } from 'react';
import { Department } from '../../types/organization';
import { AgentMetadata, AgentStatus } from '../../types/metadata';

export interface DraftAgent {
  id: string;
  name: string;
  description: string;
  position: string;
  departmentId: string | null;
  specialization: string[];
  isDraft: true;
  createdAt: Date;
}

export interface DraftAgentEditorProps {
  isOpen: boolean;
  draftAgent: DraftAgent | null;
  departments: Department[];
  onSave: (draftAgent: DraftAgent) => void;
  onCancel: () => void;
  onDelete?: (draftAgentId: string) => void;
}

export const DraftAgentEditor: React.FC<DraftAgentEditorProps> = ({
  isOpen,
  draftAgent,
  departments,
  onSave,
  onCancel,
  onDelete
}) => {
  const [formData, setFormData] = useState<Partial<DraftAgent>>({
    name: '',
    description: '',
    position: 'Agent',
    departmentId: null,
    specialization: []
  });
  const [specializationInput, setSpecializationInput] = useState('');

  // Initialize form when draftAgent changes
  useEffect(() => {
    if (draftAgent) {
      setFormData({
        name: draftAgent.name,
        description: draftAgent.description,
        position: draftAgent.position,
        departmentId: draftAgent.departmentId,
        specialization: draftAgent.specialization
      });
      setSpecializationInput(draftAgent.specialization.join(', '));
    } else {
      setFormData({
        name: '',
        description: '',
        position: 'Agent',
        departmentId: null,
        specialization: []
      });
      setSpecializationInput('');
    }
  }, [draftAgent]);

  const handleSave = () => {
    if (!formData.name?.trim()) {
      alert('Agent name is required');
      return;
    }

    const specializations = specializationInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const savedAgent: DraftAgent = {
      id: draftAgent?.id || `draft-${Date.now()}`,
      name: formData.name.trim(),
      description: formData.description || '',
      position: formData.position || 'Agent',
      departmentId: formData.departmentId || null,
      specialization: specializations,
      isDraft: true,
      createdAt: draftAgent?.createdAt || new Date()
    };

    onSave(savedAgent);
  };

  const handleDelete = () => {
    if (draftAgent && onDelete) {
      if (confirm(`Are you sure you want to delete draft agent "${draftAgent.name}"?`)) {
        onDelete(draftAgent.id);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="draft-agent-editor-overlay">
      <style jsx>{`
        .draft-agent-editor-overlay {
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

        .editor-modal {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e9ecef;
        }

        .editor-title {
          font-size: 20px;
          font-weight: 600;
          color: #333;
          margin: 0;
        }

        .draft-badge {
          background: #ff9800;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-bottom: 6px;
        }

        .form-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          color: #333;
          background-color: #fff;
          transition: border-color 0.2s ease;
        }

        .form-input::placeholder {
          color: #999;
          opacity: 1;
        }

        .form-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
          color: #333;
        }

        .form-textarea {
          min-height: 80px;
          resize: vertical;
        }

        .form-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          color: #333;
          background: white;
          cursor: pointer;
        }

        .form-select option {
          color: #333;
          background: white;
        }

        .form-select:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
          color: #333;
        }

        .form-help {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e9ecef;
        }

        .action-button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-button.primary {
          background: #007bff;
          color: white;
        }

        .action-button.primary:hover {
          background: #0056b3;
        }

        .action-button.secondary {
          background: #6c757d;
          color: white;
        }

        .action-button.secondary:hover {
          background: #5a6268;
        }

        .action-button.danger {
          background: #dc3545;
          color: white;
        }

        .action-button.danger:hover {
          background: #c82333;
        }

        .delete-section {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #e9ecef;
        }
      `}</style>

      <div className="editor-modal">
        <div className="editor-header">
          <h2 className="editor-title">
            {draftAgent ? 'Edit Draft Agent' : 'Create New Agent'}
          </h2>
          <span className="draft-badge">DRAFT</span>
        </div>

        <div className="form-group">
          <label className="form-label">Agent Name *</label>
          <input
            type="text"
            className="form-input"
            value={formData.name || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter agent name..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-input form-textarea"
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the agent's role and responsibilities..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Position/Title</label>
          <input
            type="text"
            className="form-input"
            value={formData.position || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
            placeholder="e.g., Marketing Specialist, Data Analyst..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Department</label>
          <select
            className="form-select"
            value={formData.departmentId || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, departmentId: e.target.value || null }))}
          >
            <option value="">Select a department...</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Specializations</label>
          <input
            type="text"
            className="form-input"
            value={specializationInput}
            onChange={(e) => setSpecializationInput(e.target.value)}
            placeholder="e.g., Social Media, Content Creation, Analytics..."
          />
          <div className="form-help">
            Separate multiple specializations with commas
          </div>
        </div>

        <div className="action-buttons">
          {draftAgent && onDelete && (
            <button
              className="action-button danger"
              onClick={handleDelete}
              type="button"
            >
              🗑️ Delete
            </button>
          )}
          <button
            className="action-button secondary"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="action-button primary"
            onClick={handleSave}
            type="button"
          >
            {draftAgent ? 'Update' : 'Create'} Agent
          </button>
        </div>
      </div>
    </div>
  );
}; 