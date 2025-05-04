import { useState, useEffect, useCallback } from 'react';
import useMemory from './useMemory';
import { MemoryType } from '../server/memory/config';

// Add missing memory types for tools and diagnostics
const TOOLS_MEMORY_TYPE = 'tool' as any;
const DIAGNOSTICS_MEMORY_TYPE = 'diagnostic' as any;

/**
 * Specialized memory hook for tools and diagnostics memory management
 */
export default function useToolsMemory() {
  // Use the base memory hook for tools and diagnostics memory types
  const {
    memories: toolsMemories,
    isLoading,
    error,
    getMemories,
    addMemory,
    updateMemory,
    deleteMemory,
    searchMemories,
  } = useMemory([TOOLS_MEMORY_TYPE, DIAGNOSTICS_MEMORY_TYPE]);

  // Additional state for tracking operation status
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [toolResults, setToolResults] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Load tools and diagnostics on mount
  useEffect(() => {
    getMemories({ types: [TOOLS_MEMORY_TYPE, DIAGNOSTICS_MEMORY_TYPE], limit: 50 });
  }, []);

  // Implementation of getMemoryById for tools and diagnostics
  const getMemoryById = useCallback(async (id: string, type: typeof TOOLS_MEMORY_TYPE | typeof DIAGNOSTICS_MEMORY_TYPE) => {
    try {
      const response = await fetch(`/api/memory/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch memory: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching memory by ID ${id}:`, error);
      return null;
    }
  }, []);

  /**
   * Run a diagnostic operation and store result in memory
   */
  const runDiagnostic = useCallback(async (diagnosticType: string, params: Record<string, any> = {}) => {
    setIsExecuting(true);
    
    try {
      // Create a diagnostic memory entry to record the operation
      const diagnosticMemory = await addMemory({
        type: DIAGNOSTICS_MEMORY_TYPE,
        content: `Running diagnostic: ${diagnosticType}`,
        metadata: {
          diagnosticType,
          params,
          status: 'running',
          startTime: new Date().toISOString()
        }
      });
      
      // Call the API to execute the diagnostic
      const response = await fetch('/api/diagnostics/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: diagnosticType,
          params,
          memoryId: diagnosticMemory.id
        })
      });
      
      const result = await response.json();
      
      // Update the diagnostic memory with the results
      await updateMemory({
        id: diagnosticMemory.id,
        type: DIAGNOSTICS_MEMORY_TYPE,
        content: `Diagnostic ${diagnosticType}: ${result.success ? 'Success' : 'Failed'}`,
        metadata: {
          ...diagnosticMemory.metadata,
          status: result.success ? 'completed' : 'failed',
          result: result,
          endTime: new Date().toISOString(),
          duration: Date.now() - new Date(diagnosticMemory.metadata.startTime).getTime()
        }
      });
      
      // Set state with the results
      setDiagnosticResults(result);
      return result;
    } catch (error) {
      console.error(`Error running diagnostic ${diagnosticType}:`, error);
      setDiagnosticResults({ success: false, error: String(error) });
      return { success: false, error: String(error) };
    } finally {
      setIsExecuting(false);
      // Refresh the list of diagnostics
      getMemories({ types: [DIAGNOSTICS_MEMORY_TYPE], limit: 50 });
    }
  }, [addMemory, updateMemory, getMemories]);

  /**
   * Execute a tool and store its result in memory
   */
  const executeTool = useCallback(async (toolName: string, params: Record<string, any> = {}) => {
    setIsExecuting(true);
    
    try {
      // Create a tool memory entry to record the operation
      const toolMemory = await addMemory({
        type: TOOLS_MEMORY_TYPE,
        content: `Executing tool: ${toolName}`,
        metadata: {
          toolName,
          params,
          status: 'running',
          startTime: new Date().toISOString()
        }
      });
      
      // Call the API to execute the tool
      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool: toolName,
          params,
          memoryId: toolMemory.id
        })
      });
      
      const result = await response.json();
      
      // Update the tool memory with the results
      await updateMemory({
        id: toolMemory.id,
        type: TOOLS_MEMORY_TYPE,
        content: `Tool ${toolName}: ${result.success ? 'Success' : 'Failed'}`,
        metadata: {
          ...toolMemory.metadata,
          status: result.success ? 'completed' : 'failed',
          result: result,
          endTime: new Date().toISOString(),
          duration: Date.now() - new Date(toolMemory.metadata.startTime).getTime()
        }
      });
      
      // Set state with the results
      setToolResults(result);
      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      setToolResults({ success: false, error: String(error) });
      return { success: false, error: String(error) };
    } finally {
      setIsExecuting(false);
      // Refresh the list of tools
      getMemories({ types: [TOOLS_MEMORY_TYPE], limit: 50 });
    }
  }, [addMemory, updateMemory, getMemories]);

  /**
   * Get recent diagnostics with optional filtering
   */
  const getRecentDiagnostics = useCallback(async (limit: number = 10, diagnosticType?: string) => {
    try {
      // Get all diagnostics first and filter in memory
      const allResults = await getMemories({ 
        types: [DIAGNOSTICS_MEMORY_TYPE], 
        limit
      });
      
      // Filter manually if diagnosticType is provided
      const results = diagnosticType 
        ? allResults.filter((item: { metadata: { diagnosticType: string; }; }) => item.metadata?.diagnosticType === diagnosticType)
        : allResults;
        
      // Sort by timestamp descending
      return results.sort((a: { timestamp: any; }, b: { timestamp: any; }) => {
        const dateA = new Date(a.timestamp || 0).getTime();
        const dateB = new Date(b.timestamp || 0).getTime();
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error fetching recent diagnostics:', error);
      return [];
    }
  }, [getMemories]);

  /**
   * Get recent tool executions with optional filtering
   */
  const getRecentToolExecutions = useCallback(async (limit: number = 10, toolName?: string) => {
    try {
      // Get all tools first and filter in memory
      const allResults = await getMemories({
        types: [TOOLS_MEMORY_TYPE],
        limit
      });
      
      // Filter manually if toolName is provided
      const results = toolName
        ? allResults.filter((item: { metadata: { toolName: string; }; }) => item.metadata?.toolName === toolName)
        : allResults;
        
      // Sort by timestamp descending
      return results.sort((a: { timestamp: any; }, b: { timestamp: any; }) => {
        const dateA = new Date(a.timestamp || 0).getTime();
        const dateB = new Date(b.timestamp || 0).getTime();
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error fetching recent tool executions:', error);
      return [];
    }
  }, [getMemories]);

  /**
   * Clear all diagnostic history
   */
  const clearDiagnosticHistory = useCallback(async () => {
    if (!confirm('Are you sure you want to clear all diagnostic history? This cannot be undone.')) {
      return false;
    }
    
    try {
      // Find all diagnostic memories
      const diagnostics = await getMemories({ types: [DIAGNOSTICS_MEMORY_TYPE], limit: 1000 });
      
      // Delete them all
      for (const diagnostic of diagnostics) {
        await deleteMemory({ id: diagnostic.id, type: DIAGNOSTICS_MEMORY_TYPE });
      }
      
      // Refresh the list
      getMemories({ types: [DIAGNOSTICS_MEMORY_TYPE], limit: 50 });
      return true;
    } catch (error) {
      console.error('Error clearing diagnostic history:', error);
      return false;
    }
  }, [getMemories, deleteMemory]);

  /**
   * Clear all tool execution history
   */
  const clearToolHistory = useCallback(async () => {
    if (!confirm('Are you sure you want to clear all tool execution history? This cannot be undone.')) {
      return false;
    }
    
    try {
      // Find all tool memories
      const tools = await getMemories({ types: [TOOLS_MEMORY_TYPE], limit: 1000 });
      
      // Delete them all
      for (const tool of tools) {
        await deleteMemory({ id: tool.id, type: TOOLS_MEMORY_TYPE });
      }
      
      // Refresh the list
      getMemories({ types: [TOOLS_MEMORY_TYPE], limit: 50 });
      return true;
    } catch (error) {
      console.error('Error clearing tool execution history:', error);
      return false;
    }
  }, [getMemories, deleteMemory]);

  return {
    // Base memory operations
    toolsMemories,
    isLoading,
    error,
    isExecuting,

    // Diagnostic operations
    diagnosticResults,
    runDiagnostic,
    getRecentDiagnostics,
    clearDiagnosticHistory,

    // Tool operations
    toolResults,
    executeTool,
    getRecentToolExecutions,
    clearToolHistory,

    // Search operations
    searchMemories,
    getMemoryById
  };
} 