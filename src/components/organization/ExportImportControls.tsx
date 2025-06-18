'use client';

import React, { useState, useRef } from 'react';
import { Department, OrganizationChart } from '../../types/organization';
import { AgentMetadata } from '../../types/metadata';

export interface ExportImportControlsProps {
  departments: Department[];
  agents: AgentMetadata[];
  onImport: (data: OrganizationImportData) => Promise<void>;
  className?: string;
}

export interface OrganizationExportData {
  version: string;
  exportedAt: string;
  organizationName?: string;
  departments: Department[];
  agents: AgentMetadata[];
  metadata: {
    totalDepartments: number;
    totalAgents: number;
    exportType: 'full' | 'structure' | 'agents';
  };
}

export interface OrganizationImportData {
  departments: Department[];
  agents: AgentMetadata[];
  importType: 'merge' | 'replace';
}

/**
 * Export/Import Controls Component
 * Provides functionality to export and import organizational data
 */
export const ExportImportControls: React.FC<ExportImportControlsProps> = ({
  departments,
  agents,
  onImport,
  className = ''
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportType, setExportType] = useState<'full' | 'structure' | 'agents'>('full');
  const [importType, setImportType] = useState<'merge' | 'replace'>('merge');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let exportData: OrganizationExportData;

      switch (exportType) {
        case 'structure':
          exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            departments,
            agents: [], // Only structure, no agents
            metadata: {
              totalDepartments: departments.length,
              totalAgents: 0,
              exportType: 'structure'
            }
          };
          break;
        case 'agents':
          exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            departments: [], // Only agents, no structure
            agents,
            metadata: {
              totalDepartments: 0,
              totalAgents: agents.length,
              exportType: 'agents'
            }
          };
          break;
        default: // 'full'
          exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            departments,
            agents,
            metadata: {
              totalDepartments: departments.length,
              totalAgents: agents.length,
              exportType: 'full'
            }
          };
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `organization-${exportType}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export organization data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setIsImporting(true);
        const content = e.target?.result as string;
        const importData: OrganizationExportData = JSON.parse(content);

        // Validate import data
        if (!importData.version || (!importData.departments && !importData.agents)) {
          throw new Error('Invalid organization data format');
        }

        await onImport({
          departments: importData.departments || [],
          agents: importData.agents || [],
          importType
        });

        setShowImportDialog(false);
        alert('Organization data imported successfully');
      } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import organization data. Please check the file format.');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`export-import-controls ${className}`}>
      {/* Export Controls */}
      <div className="flex items-center space-x-2">
        <div className="relative">
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value as 'full' | 'structure' | 'agents')}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="full">Full Organization</option>
            <option value="structure">Structure Only</option>
            <option value="agents">Agents Only</option>
          </select>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </>
          )}
        </button>

        <button
          onClick={() => setShowImportDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Import
        </button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={() => setShowImportDialog(false)} />
            
            <div className="inline-block align-bottom bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-gray-800 px-6 py-4">
                <h3 className="text-lg font-medium text-white mb-4">Import Organization Data</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Import Type</label>
                    <select
                      value={importType}
                      onChange={(e) => setImportType(e.target.value as 'merge' | 'replace')}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="merge">Merge with existing data</option>
                      <option value="replace">Replace existing data</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {importType === 'merge' 
                        ? 'Add imported data to existing organization'
                        : 'Replace all existing data with imported data'
                      }
                    </p>
                  </div>

                  <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded-lg p-3">
                    <div className="flex">
                      <svg className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="text-yellow-400 font-medium text-sm">Warning</h4>
                        <p className="text-yellow-200 text-xs mt-1">
                          {importType === 'replace' 
                            ? 'This will permanently delete all existing organizational data.'
                            : 'Imported data may conflict with existing entries.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 px-6 py-4 flex justify-between">
                <button
                  onClick={() => setShowImportDialog(false)}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Cancel
                </button>
                
                <div className="flex space-x-3">
                  <button
                    onClick={triggerFileInput}
                    disabled={isImporting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
                  >
                    {isImporting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Importing...
                      </>
                    ) : (
                      'Choose File'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportImportControls; 