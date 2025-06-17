'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Building, DollarSign, Users } from 'lucide-react';

export interface Department {
  id: string;
  name: string;
  description?: string;
  code?: string;
  isActive: boolean;
  budgetLimit?: number;
  currentSpent?: number;
  currency?: string;
  costCenterId?: string;
  managerId?: string;
  parentDepartmentId?: string;
  createdAt: string;
  updatedAt: string;
  parentDepartment?: {
    id: string;
    name: string;
  };
  subDepartments?: {
    id: string;
    name: string;
  }[];
}

interface DepartmentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DepartmentManagementModal: React.FC<DepartmentManagementModalProps> = ({
  isOpen,
  onClose
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    code: '',
    budgetLimit: '',
    currency: 'USD',
    parentDepartmentId: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
    }
  }, [isOpen]);

  const fetchDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/departments');
      const data = await response.json();
      
      if (data.success) {
        setDepartments(data.departments);
      } else {
        setError(data.error || 'Failed to fetch departments');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Department name is required');
      return;
    }

    const isEditing = !!editingDepartment;
    const url = isEditing ? `/api/departments/${editingDepartment.id}` : '/api/departments';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          budgetLimit: formData.budgetLimit ? parseFloat(formData.budgetLimit) : null,
          parentDepartmentId: formData.parentDepartmentId || null
        }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchDepartments();
        resetForm();
        setError(null);
      } else {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'create'} department`);
      }
    } catch (err) {
      setError(`Failed to ${isEditing ? 'update' : 'create'} department`);
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      code: department.code || '',
      budgetLimit: department.budgetLimit?.toString() || '',
      currency: department.currency || 'USD',
      parentDepartmentId: department.parentDepartmentId || ''
    });
    setIsCreating(true);
  };

  const handleDelete = async (department: Department) => {
    if (!confirm(`Are you sure you want to delete "${department.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/departments/${department.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchDepartments();
        setError(null);
      } else {
        setError(data.error || 'Failed to delete department');
      }
    } catch (err) {
      setError('Failed to delete department');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      code: '',
      budgetLimit: '',
      currency: 'USD',
      parentDepartmentId: ''
    });
    setIsCreating(false);
    setEditingDepartment(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <Building className="mr-2 h-5 w-5" />
            Department Management
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {isCreating && (
          <div className="mb-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
            <h3 className="text-lg font-medium text-white mb-4">
              {editingDepartment ? 'Edit Department' : 'Create New Department'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Marketing"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Department Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., MKT"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Budget Limit
                  </label>
                  <div className="flex">
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="px-3 py-2 bg-gray-600 border border-gray-500 rounded-l-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.budgetLimit}
                      onChange={(e) => setFormData({ ...formData, budgetLimit: e.target.value })}
                      className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-r-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Parent Department
                  </label>
                  <select
                    value={formData.parentDepartmentId}
                    onChange={(e) => setFormData({ ...formData, parentDepartmentId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None (Top Level)</option>
                    {departments
                      .filter(dept => dept.id !== editingDepartment?.id)
                      .map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Department description..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                >
                  {editingDepartment ? 'Update' : 'Create'} Department
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Add Department Button */}
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="mb-6 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </button>
        )}

        {/* Departments List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-gray-400 mt-2">Loading departments...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {departments.length === 0 ? (
              <div className="text-center py-8">
                <Building className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No departments found</p>
                <p className="text-sm text-gray-500">Create your first department to get started</p>
              </div>
            ) : (
              departments.map((department) => (
                <div
                  key={department.id}
                  className="p-4 bg-gray-700 rounded-lg border border-gray-600"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg font-medium text-white">
                          {department.name}
                        </h3>
                        {department.code && (
                          <span className="ml-2 px-2 py-1 bg-gray-600 text-xs text-gray-300 rounded">
                            {department.code}
                          </span>
                        )}
                        {department.parentDepartment && (
                          <span className="ml-2 text-sm text-gray-400">
                            → {department.parentDepartment.name}
                          </span>
                        )}
                      </div>
                      
                      {department.description && (
                        <p className="text-gray-300 text-sm mb-2">{department.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        {department.budgetLimit && (
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Budget: {department.currency} {department.budgetLimit.toLocaleString()}
                          </div>
                        )}
                        {department.subDepartments && department.subDepartments.length > 0 && (
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {department.subDepartments.length} sub-departments
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(department)}
                        className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Edit department"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(department)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete department"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 