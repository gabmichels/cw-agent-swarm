import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip } from '../ui/tooltip';
import { 
  WorkflowCardProps, 
  WorkflowComplexity,
  WORKFLOW_COMPLEXITY_LABELS,
  WORKFLOW_COMPLEXITY_COLORS,
  WORKFLOW_CATEGORY_ICONS
} from '../../types/workflow';

/**
 * WorkflowCard component for displaying individual workflow information
 * Follows immutability principles and strict typing
 */
export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  workflow,
  viewMode,
  onImport,
  onPreview,
  onFavorite,
  isFavorited = false,
  isImporting = false
}) => {
  const handleImport = React.useCallback(async (): Promise<void> => {
    try {
      await onImport(workflow);
    } catch (error) {
      console.error('Failed to import workflow:', error);
    }
  }, [onImport, workflow]);

  const handlePreview = React.useCallback((): void => {
    onPreview(workflow);
  }, [onPreview, workflow]);

  const handleFavorite = React.useCallback((): void => {
    if (onFavorite) {
      onFavorite(workflow);
    }
  }, [onFavorite, workflow]);

  const complexityColor = WORKFLOW_COMPLEXITY_COLORS[workflow.complexity];
  const categoryIcon = WORKFLOW_CATEGORY_ICONS[workflow.category];
  const complexityLabel = WORKFLOW_COMPLEXITY_LABELS[workflow.complexity];

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const truncateDescription = (description: string, maxLength: number): string => {
    if (description.length <= maxLength) return description;
    return `${description.substring(0, maxLength)}...`;
  };

  if (viewMode === 'list') {
    return (
      <Card className="p-4 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{categoryIcon}</span>
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {workflow.name}
              </h3>
              <Badge className={complexityColor}>
                {complexityLabel}
              </Badge>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">
              {truncateDescription(workflow.description, 150)}
            </p>
            
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{workflow.nodeCount} nodes</span>
              <span>•</span>
              <span>Updated {workflow.updatedAt ? formatDate(workflow.updatedAt) : 'Unknown'}</span>
              <span>•</span>
              <span>Category: {workflow.category}</span>
              {workflow.tags.length > 0 && (
                <>
                  <span>•</span>
                  <div className="flex gap-1">
                    {workflow.tags.slice(0, 3).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {workflow.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{workflow.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onFavorite && (
              <Tooltip content={isFavorited ? 'Remove from favorites' : 'Add to favorites'}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFavorite}
                  className={isFavorited ? 'text-red-600 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'}
                >
                  {isFavorited ? '❤️' : '🤍'}
                </Button>
              </Tooltip>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              className="whitespace-nowrap"
            >
              Preview
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={handleImport}
              disabled={isImporting}
              className="whitespace-nowrap"
            >
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Grid view mode
  return (
    <Card className="p-4 hover:shadow-lg transition-all duration-200 h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{categoryIcon}</span>
          <Badge className={complexityColor}>
            {complexityLabel}
          </Badge>
        </div>
        
        {onFavorite && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFavorite}
            className={`${isFavorited ? 'text-red-600 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'} p-1`}
          >
            {isFavorited ? '❤️' : '🤍'}
          </Button>
        )}
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
        {workflow.name}
      </h3>
      
      <p className="text-sm text-gray-600 mb-4 flex-1 line-clamp-3">
        {workflow.description}
      </p>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{workflow.nodeCount} nodes</span>
          <span>{workflow.category}</span>
        </div>
        
        {workflow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {workflow.tags.slice(0, 3).map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {workflow.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{workflow.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
        
        <div className="text-xs text-gray-400 mb-4">
          Updated {workflow.updatedAt ? formatDate(workflow.updatedAt) : 'Unknown'}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            className="flex-1"
          >
            Preview
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={handleImport}
            disabled={isImporting}
            className="flex-1"
          >
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default WorkflowCard; 