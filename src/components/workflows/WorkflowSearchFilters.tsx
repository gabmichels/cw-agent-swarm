import React from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import {
  WorkflowCategory,
  WorkflowComplexity,
  WorkflowLibraryFilters,
  WORKFLOW_COMPLEXITY_LABELS,
  WORKFLOW_CATEGORY_ICONS
} from '../../types/workflow';

interface WorkflowSearchFiltersProps {
  readonly searchQuery: string;
  readonly filters: WorkflowLibraryFilters;
  readonly onSearchChange: (query: string) => void;
  readonly onFiltersChange: (filters: Partial<WorkflowLibraryFilters>) => void;
  readonly onClearFilters: () => void;
  readonly availableCategories: ReadonlyArray<WorkflowCategory>;
  readonly availableIntegrations: ReadonlyArray<string>;
}

/**
 * WorkflowSearchFilters component with debounced search and filter controls
 * Implements pure functional design with immutable state updates
 */
export const WorkflowSearchFilters: React.FC<WorkflowSearchFiltersProps> = ({
  searchQuery,
  filters,
  onSearchChange,
  onFiltersChange,
  onClearFilters,
  availableCategories,
  availableIntegrations
}) => {
  const [localSearchQuery, setLocalSearchQuery] = React.useState(searchQuery);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Debounced search implementation
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        onSearchChange(localSearchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localSearchQuery, searchQuery, onSearchChange]);

  // Update local search when external search changes
  React.useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleCategoryToggle = React.useCallback((category: WorkflowCategory): void => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    
    onFiltersChange({ categories: newCategories });
  }, [filters.categories, onFiltersChange]);

  const handleComplexityChange = React.useCallback((complexity: WorkflowComplexity | null): void => {
    onFiltersChange({ complexity });
  }, [onFiltersChange]);

  const handleIntegrationToggle = React.useCallback((integration: string): void => {
    const newIntegrations = filters.integrations.includes(integration)
      ? filters.integrations.filter(i => i !== integration)
      : [...filters.integrations, integration];
    
    onFiltersChange({ integrations: newIntegrations });
  }, [filters.integrations, onFiltersChange]);

  const hasActiveFilters = React.useMemo((): boolean => {
    return filters.categories.length > 0 ||
           filters.complexity !== null ||
           filters.integrations.length > 0 ||
           filters.nodeCountRange !== null ||
           filters.tags.length > 0;
  }, [filters]);

  const complexityOptions: ReadonlyArray<WorkflowComplexity> = ['simple', 'medium', 'complex'];

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search workflows by name, description, or integration..."
          value={localSearchQuery}
          onChange={(e) => setLocalSearchQuery(e.target.value)}
          className="pl-10 pr-4"
        />
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          🔍
        </div>
      </div>

      {/* Quick Category Filters */}
      <div className="flex flex-wrap gap-2">
        {availableCategories.map((category) => {
          const isSelected = filters.categories.includes(category);
          const icon = WORKFLOW_CATEGORY_ICONS[category];
          
          return (
            <Button
              key={category}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategoryToggle(category)}
              className="text-sm"
            >
              <span className="mr-1">{icon}</span>
              {category.replace('_', ' ')}
            </Button>
          );
        })}
      </div>

      {/* Advanced Filters Toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-gray-600"
        >
          {showAdvanced ? '▼' : '▶'} Advanced Filters
        </Button>
        
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear All Filters
          </Button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <Card className="p-4 space-y-4">
          {/* Complexity Filter */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Complexity Level</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filters.complexity === null ? "default" : "outline"}
                size="sm"
                onClick={() => handleComplexityChange(null)}
              >
                All Levels
              </Button>
              {complexityOptions.map((complexity) => (
                <Button
                  key={complexity}
                  variant={filters.complexity === complexity ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleComplexityChange(complexity)}
                >
                  {WORKFLOW_COMPLEXITY_LABELS[complexity]}
                </Button>
              ))}
            </div>
          </div>

          {/* Popular Integrations Filter */}
          {availableIntegrations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Integrations</h4>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {availableIntegrations.slice(0, 20).map((integration) => {
                  const isSelected = filters.integrations.includes(integration);
                  
                  return (
                    <Badge
                      key={integration}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => handleIntegrationToggle(integration)}
                    >
                      {integration}
                    </Badge>
                  );
                })}
                {availableIntegrations.length > 20 && (
                  <Badge variant="outline" className="text-gray-500">
                    +{availableIntegrations.length - 20} more...
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Node Count Range Filter */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Workflow Size</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filters.nodeCountRange === null ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ nodeCountRange: null })}
              >
                Any Size
              </Button>
              <Button
                variant={JSON.stringify(filters.nodeCountRange) === JSON.stringify([1, 5]) ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ nodeCountRange: [1, 5] })}
              >
                Simple (1-5 nodes)
              </Button>
              <Button
                variant={JSON.stringify(filters.nodeCountRange) === JSON.stringify([6, 15]) ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ nodeCountRange: [6, 15] })}
              >
                Medium (6-15 nodes)
              </Button>
              <Button
                variant={JSON.stringify(filters.nodeCountRange) === JSON.stringify([16, 50]) ? "default" : "outline"}
                size="sm"
                onClick={() => onFiltersChange({ nodeCountRange: [16, 50] })}
              >
                Complex (16+ nodes)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-800">Active filters:</span>
          
          {filters.categories.map((category) => (
            <Badge key={category} variant="secondary" className="text-blue-800">
              {WORKFLOW_CATEGORY_ICONS[category]} {category.replace('_', ' ')}
              <button
                className="ml-1 hover:text-blue-900"
                onClick={() => handleCategoryToggle(category)}
              >
                ×
              </button>
            </Badge>
          ))}
          
          {filters.complexity && (
            <Badge variant="secondary" className="text-blue-800">
              {WORKFLOW_COMPLEXITY_LABELS[filters.complexity]}
              <button
                className="ml-1 hover:text-blue-900"
                onClick={() => handleComplexityChange(null)}
              >
                ×
              </button>
            </Badge>
          )}
          
          {filters.integrations.map((integration) => (
            <Badge key={integration} variant="secondary" className="text-blue-800">
              {integration}
              <button
                className="ml-1 hover:text-blue-900"
                onClick={() => handleIntegrationToggle(integration)}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowSearchFilters; 