import React from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { WorkflowCard } from './WorkflowCard';
import { WorkflowSearchFilters } from './WorkflowSearchFilters';
import { WorkflowDetailsModal } from './WorkflowDetailsModal';
import { WorkflowImportProgress } from './WorkflowImportProgress';
import {
  WorkflowLibraryBrowserProps,
  WorkflowLibraryState,
  WorkflowLibraryAction,
  WorkflowLibraryFilters,
  N8nWorkflowTemplate,
  WorkflowSearchResults,
  WorkflowCategory,
  WorkflowImportOptions
} from '../../types/workflow';
import { WorkflowSearchService } from '../../services/external-workflows/integrations/WorkflowSearchService';
import { N8nWorkflowApiClient } from '../../services/external-workflows/integrations/N8nWorkflowApiClient';
import { useWorkflowFavorites } from '../../hooks/useWorkflowFavorites';
import { useWorkflowAnalytics } from '../../hooks/useWorkflowAnalytics';

/**
 * Initial state factory function - pure function for state initialization
 */
const createInitialState = (initialFilters?: Partial<WorkflowLibraryFilters>): WorkflowLibraryState => ({
  workflows: [],
  categories: ['messaging', 'email', 'productivity', 'social_media', 'ecommerce', 'analytics', 'calendar', 'forms', 'development', 'files', 'crm', 'general'],
  searchQuery: '',
  selectedCategories: initialFilters?.categories || [],
  selectedComplexity: initialFilters?.complexity || null,
  viewMode: 'grid',
  sortBy: 'popularity',
  sortOrder: 'desc',
  isLoading: false,
  error: null,
  totalResults: 0,
  currentPage: 1,
  itemsPerPage: 24
});

/**
 * State reducer - pure function for state management
 */
const workflowLibraryReducer = (state: WorkflowLibraryState, action: WorkflowLibraryAction): WorkflowLibraryState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: null };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_WORKFLOWS':
      return {
        ...state,
        workflows: action.payload.workflows,
        totalResults: action.payload.total,
        currentPage: action.payload.page,
        isLoading: false,
        error: null
      };
    
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
    
    case 'SET_FILTERS':
      return {
        ...state,
        selectedCategories: action.payload.categories ?? state.selectedCategories,
        selectedComplexity: action.payload.complexity ?? state.selectedComplexity,
        currentPage: 1
      };
    
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    
    case 'SET_SORT':
      return {
        ...state,
        sortBy: action.payload.sortBy,
        sortOrder: action.payload.sortOrder,
        currentPage: 1
      };
    
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    
    default:
      return state;
  }
};

/**
 * WorkflowLibraryBrowser - Main component for browsing and searching workflows
 * Implements dependency injection, immutable state, and pure functions
 */
export const WorkflowLibraryBrowser: React.FC<WorkflowLibraryBrowserProps> = ({
  initialFilters,
  onWorkflowImport,
  onWorkflowPreview,
  className = ''
}) => {
  const [state, dispatch] = React.useReducer(
    workflowLibraryReducer,
    initialFilters,
    createInitialState
  );

  // Service dependency injection
  const searchService = React.useMemo(() => {
    const apiClient = new N8nWorkflowApiClient(8001);
    return new WorkflowSearchService(apiClient);
  }, []);

  // Favorites management
  const { 
    favorites, 
    isFavorited, 
    addFavorite, 
    removeFavorite, 
    favoritesCount 
  } = useWorkflowFavorites();

  // Analytics tracking
  const {
    trackWorkflowView,
    trackWorkflowPreview,
    trackWorkflowImport,
    trackWorkflowFavorite,
    trackWorkflowSearch
  } = useWorkflowAnalytics();

  // Available integrations for filtering
  const [availableIntegrations, setAvailableIntegrations] = React.useState<ReadonlyArray<string>>([]);
  
  // Modal state management
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<N8nWorkflowTemplate | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);
  const [isImportProgressOpen, setIsImportProgressOpen] = React.useState(false);
  const [importingWorkflow, setImportingWorkflow] = React.useState<N8nWorkflowTemplate | null>(null);

  const currentFilters: WorkflowLibraryFilters = React.useMemo(() => ({
    categories: state.selectedCategories,
    complexity: state.selectedComplexity,
    integrations: [],
    nodeCountRange: null,
    tags: []
  }), [state.selectedCategories, state.selectedComplexity]);

  /**
   * Search workflows with current filters and query
   * Pure function approach with side effects isolated
   */
  const searchWorkflows = React.useCallback(async (): Promise<void> => {
    if (!searchService) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const searchQuery = {
        q: state.searchQuery || undefined,
        category: state.selectedCategories.length === 1 ? state.selectedCategories[0] : undefined,
        complexity: state.selectedComplexity || undefined,
        limit: state.itemsPerPage,
        offset: (state.currentPage - 1) * state.itemsPerPage,
        sortBy: (state.sortBy === 'popularity' ? 'popularity' : 
               state.sortBy === 'name' ? 'name' : 
               state.sortBy === 'updated' ? 'recent' : 'popularity') as 'name' | 'popularity' | 'complexity' | 'recent',
        sortOrder: state.sortOrder
      };

      const searchResult = await searchService.searchWorkflows(searchQuery);
      
      // Transform the search result into the expected format
      const results: WorkflowSearchResults = {
        workflows: searchResult.workflows,
        total: searchResult.total,
        page: state.currentPage,
        pageSize: state.itemsPerPage,
        searchTime: searchResult.searchTime,
        categories: searchResult.categories,
        integrations: searchResult.integrations
      };
      
      dispatch({ type: 'SET_WORKFLOWS', payload: results });

      // Update available integrations for filter
      if (results.integrations) {
        setAvailableIntegrations(results.integrations.map(i => i.integration));
      }

      // Track search analytics
      if (searchQuery.q && searchResult.total > 0) {
        trackWorkflowSearch(searchQuery.q, searchResult.total);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search workflows';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [searchService, state.searchQuery, state.selectedCategories, state.selectedComplexity, state.sortBy, state.sortOrder, state.currentPage, state.itemsPerPage, trackWorkflowSearch]);

  // Search on mount and when search parameters change
  React.useEffect(() => {
    searchWorkflows();
  }, [searchWorkflows]);

  // Event handlers - all pure functions
  const handleSearchChange = React.useCallback((query: string): void => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, []);

  const handleFiltersChange = React.useCallback((filters: Partial<WorkflowLibraryFilters>): void => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const handleClearFilters = React.useCallback((): void => {
    dispatch({ type: 'SET_FILTERS', payload: { categories: [], complexity: null } });
  }, []);

  const handleViewModeChange = React.useCallback((mode: 'grid' | 'list'): void => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  const handleSortChange = React.useCallback((sortBy: WorkflowLibraryState['sortBy']): void => {
    const newOrder = state.sortBy === sortBy && state.sortOrder === 'desc' ? 'asc' : 'desc';
    dispatch({ type: 'SET_SORT', payload: { sortBy, sortOrder: newOrder } });
  }, [state.sortBy, state.sortOrder]);

  const handlePageChange = React.useCallback((page: number): void => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const handleWorkflowImport = React.useCallback(async (workflow: N8nWorkflowTemplate): Promise<void> => {
    // Track analytics
    trackWorkflowView(workflow);
    
    // Open details modal for import customization
    setSelectedWorkflow(workflow);
    setIsDetailsModalOpen(true);
  }, [trackWorkflowView]);

  const handleWorkflowPreview = React.useCallback((workflow: N8nWorkflowTemplate): void => {
    // Track analytics
    trackWorkflowPreview(workflow);
    
    // Open details modal for preview
    setSelectedWorkflow(workflow);
    setIsDetailsModalOpen(true);
  }, [trackWorkflowPreview]);

  const handleDetailsModalImport = React.useCallback(async (workflow: N8nWorkflowTemplate, options: WorkflowImportOptions): Promise<void> => {
    try {
      // Track import analytics
      trackWorkflowImport(workflow);
      
      // Close details modal and start import progress
      setIsDetailsModalOpen(false);
      setImportingWorkflow(workflow);
      setIsImportProgressOpen(true);

      // Call the parent import handler if provided
      if (onWorkflowImport) {
        await onWorkflowImport(workflow);
      }
    } catch (error) {
      console.error('Failed to start workflow import:', error);
      // Keep the progress modal open to show the error
    }
  }, [onWorkflowImport, trackWorkflowImport]);

  const handleImportComplete = React.useCallback((workflow: N8nWorkflowTemplate): void => {
    // Close progress modal and refresh the list
    setIsImportProgressOpen(false);
    setImportingWorkflow(null);
    
    // Optionally refresh the workflow list or switch to external workflows tab
    // This could trigger a callback to the parent component
  }, []);

  const handleImportRetry = React.useCallback((): void => {
    // Close progress modal and reopen details modal
    setIsImportProgressOpen(false);
    if (importingWorkflow) {
      setSelectedWorkflow(importingWorkflow);
      setIsDetailsModalOpen(true);
    }
    setImportingWorkflow(null);
  }, [importingWorkflow]);

  const handleCloseDetailsModal = React.useCallback((): void => {
    setIsDetailsModalOpen(false);
    setSelectedWorkflow(null);
  }, []);

  const handleCloseImportProgress = React.useCallback((): void => {
    setIsImportProgressOpen(false);
    setImportingWorkflow(null);
  }, []);

  const handleWorkflowFavorite = React.useCallback(async (workflow: N8nWorkflowTemplate): Promise<void> => {
    try {
      const workflowId = workflow.id.toString();
      const wasFavorited = isFavorited(workflowId);
      
      if (wasFavorited) {
        await removeFavorite(workflowId);
      } else {
        await addFavorite(workflow);
      }
      
      // Track analytics
      trackWorkflowFavorite(workflow, !wasFavorited);
    } catch (error) {
      console.error('Failed to update workflow favorite:', error);
    }
  }, [isFavorited, addFavorite, removeFavorite, trackWorkflowFavorite]);

  // Computed values
  const totalPages = Math.ceil(state.totalResults / state.itemsPerPage);
  const startIndex = (state.currentPage - 1) * state.itemsPerPage + 1;
  const endIndex = Math.min(state.currentPage * state.itemsPerPage, state.totalResults);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Library</h1>
          <p className="text-gray-600 mt-1">
            Browse and import from 2,053+ premade workflows
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={state.viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleViewModeChange('grid')}
          >
            ⊞ Grid
          </Button>
          <Button
            variant={state.viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleViewModeChange('list')}
          >
            ☰ List
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <WorkflowSearchFilters
        searchQuery={state.searchQuery}
        filters={currentFilters}
        onSearchChange={handleSearchChange}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        availableCategories={state.categories}
        availableIntegrations={availableIntegrations}
      />

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {state.totalResults > 0 ? (
            <>Showing {startIndex}-{endIndex} of {state.totalResults} workflows</>
          ) : (
            'No workflows found'
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSortChange('popularity')}
            className={state.sortBy === 'popularity' ? 'font-semibold' : ''}
          >
            Popularity {state.sortBy === 'popularity' && (state.sortOrder === 'desc' ? '↓' : '↑')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSortChange('name')}
            className={state.sortBy === 'name' ? 'font-semibold' : ''}
          >
            Name {state.sortBy === 'name' && (state.sortOrder === 'desc' ? '↓' : '↑')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSortChange('updated')}
            className={state.sortBy === 'updated' ? 'font-semibold' : ''}
          >
            Updated {state.sortBy === 'updated' && (state.sortOrder === 'desc' ? '↓' : '↑')}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {state.isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Searching workflows...</span>
        </div>
      )}

      {/* Error State */}
      {state.error && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="text-red-800">
            <h3 className="font-semibold mb-2">Failed to load workflows</h3>
            <p className="text-sm">{state.error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={searchWorkflows}
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* Workflows Grid/List */}
      {!state.isLoading && !state.error && state.workflows.length > 0 && (
        <div className={
          state.viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-4'
        }>
          {state.workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id.toString()}
              workflow={workflow}
              viewMode={state.viewMode}
              onImport={handleWorkflowImport}
              onPreview={handleWorkflowPreview}
              onFavorite={handleWorkflowFavorite}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!state.isLoading && !state.error && state.workflows.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-gray-400 text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No workflows found</h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search terms or filters to find relevant workflows.
          </p>
          <Button
            variant="outline"
            onClick={handleClearFilters}
          >
            Clear All Filters
          </Button>
        </Card>
      )}

      {/* Pagination */}
      {!state.isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(state.currentPage - 1)}
            disabled={state.currentPage === 1}
          >
            ← Previous
          </Button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = state.currentPage <= 3 
              ? i + 1 
              : state.currentPage >= totalPages - 2
                ? totalPages - 4 + i
                : state.currentPage - 2 + i;
            
            if (page < 1 || page > totalPages) return null;
            
            return (
              <Button
                key={page}
                variant={page === state.currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePageChange(page)}
              >
                {page}
              </Button>
            );
          })}
          
          {totalPages > 5 && state.currentPage < totalPages - 2 && (
            <>
              <span className="text-gray-400">...</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
              >
                {totalPages}
              </Button>
            </>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(state.currentPage + 1)}
            disabled={state.currentPage === totalPages}
          >
            Next →
          </Button>
        </div>
      )}

      {/* Workflow Details Modal */}
      <WorkflowDetailsModal
        workflow={selectedWorkflow}
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        onImport={handleDetailsModalImport}
        isImporting={isImportProgressOpen}
      />

      {/* Workflow Import Progress Modal */}
      <WorkflowImportProgress
        workflow={importingWorkflow}
        isOpen={isImportProgressOpen}
        onClose={handleCloseImportProgress}
        onComplete={handleImportComplete}
        onRetry={handleImportRetry}
      />
    </div>
  );
};

export default WorkflowLibraryBrowser; 