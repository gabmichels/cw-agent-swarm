import { useState, useEffect, useCallback } from 'react';
import { CapabilityType } from '@/agents/shared/capability-system';

export interface DatabaseCapability {
  id: string;
  name: string;
  description: string;
  type: CapabilityType;
  version: string;
  parameters?: Record<string, unknown>;
  tags: string[];
  domains: string[];
  content: string;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: string;
}

export interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

interface UseCapabilitiesFromDatabaseOptions {
  type?: CapabilityType;
  searchQuery?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

interface UseCapabilitiesFromDatabaseResult {
  capabilities: DatabaseCapability[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  refetch: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
  hasMore: boolean;
}

/**
 * Hook to fetch capabilities from the database
 */
export function useCapabilitiesFromDatabase({
  type,
  searchQuery,
  limit = 20,
  offset = 0,
  enabled = true
}: UseCapabilitiesFromDatabaseOptions = {}): UseCapabilitiesFromDatabaseResult {
  const [capabilities, setCapabilities] = useState<DatabaseCapability[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentOffset, setCurrentOffset] = useState(offset);
  
  // Use useCallback to create a stable function reference that won't change on re-renders
  const fetchCapabilities = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build the query string
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (searchQuery) params.append('query', searchQuery);
      if (limit) params.append('limit', limit.toString());
      params.append('offset', currentOffset.toString());
      
      // Fetch capabilities from the API
      const response = await fetch(`/api/multi-agent/capabilities?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch capabilities');
      }
      
      const data = await response.json();
      setCapabilities(data.capabilities || []);
      
      // Handle pagination
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching capabilities:', err);
    } finally {
      setLoading(false);
    }
  }, [type, searchQuery, limit, currentOffset, enabled]);

  // Fetch next page of capabilities
  const fetchNextPage = useCallback(async () => {
    if (!pagination?.hasMore || loading) return;
    
    const nextOffset = currentOffset + limit;
    setCurrentOffset(nextOffset);
  }, [pagination, loading, currentOffset, limit]);

  // Fetch capabilities when the component mounts or when dependencies change
  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);
  
  // Reset offset when type or search query changes
  useEffect(() => {
    setCurrentOffset(0);
  }, [type, searchQuery]);

  return {
    capabilities,
    loading,
    error,
    pagination,
    refetch: fetchCapabilities,
    fetchNextPage,
    hasMore: pagination?.hasMore || false
  };
} 