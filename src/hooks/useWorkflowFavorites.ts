import { useState, useEffect, useCallback } from 'react';
import { N8nWorkflowTemplate } from '../types/workflow';

interface WorkflowFavorite {
  readonly workflowId: string;
  readonly name: string;
  readonly category: string;
  readonly addedAt: string;
}

interface UseWorkflowFavoritesReturn {
  readonly favorites: ReadonlyArray<WorkflowFavorite>;
  readonly isFavorited: (workflowId: string) => boolean;
  readonly addFavorite: (workflow: N8nWorkflowTemplate) => Promise<void>;
  readonly removeFavorite: (workflowId: string) => Promise<void>;
  readonly clearAllFavorites: () => Promise<void>;
  readonly favoritesCount: number;
  readonly isLoading: boolean;
}

const FAVORITES_STORAGE_KEY = 'workflow-favorites';

/**
 * Hook for managing workflow favorites
 * Implements local storage persistence with error handling
 */
export const useWorkflowFavorites = (): UseWorkflowFavoritesReturn => {
  const [favorites, setFavorites] = useState<ReadonlyArray<WorkflowFavorite>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const loadFavorites = (): void => {
      try {
        const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as WorkflowFavorite[];
          setFavorites(parsed);
        }
      } catch (error) {
        console.error('Failed to load workflow favorites:', error);
        // Clear corrupted data
        localStorage.removeItem(FAVORITES_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, []);

  // Save favorites to localStorage whenever favorites change
  const saveFavorites = useCallback(async (newFavorites: ReadonlyArray<WorkflowFavorite>): Promise<void> => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Failed to save workflow favorites:', error);
      throw new Error('Failed to save favorites. Storage may be full.');
    }
  }, []);

  // Check if a workflow is favorited
  const isFavorited = useCallback((workflowId: string): boolean => {
    return favorites.some(fav => fav.workflowId === workflowId);
  }, [favorites]);

  // Add a workflow to favorites
  const addFavorite = useCallback(async (workflow: N8nWorkflowTemplate): Promise<void> => {
    const workflowId = workflow.id.toString();
    
    if (isFavorited(workflowId)) {
      return; // Already favorited
    }

    const newFavorite: WorkflowFavorite = {
      workflowId,
      name: workflow.name,
      category: workflow.category,
      addedAt: new Date().toISOString()
    };

    const newFavorites = [...favorites, newFavorite];
    setFavorites(newFavorites);
    await saveFavorites(newFavorites);
  }, [favorites, isFavorited, saveFavorites]);

  // Remove a workflow from favorites
  const removeFavorite = useCallback(async (workflowId: string): Promise<void> => {
    const newFavorites = favorites.filter(fav => fav.workflowId !== workflowId);
    setFavorites(newFavorites);
    await saveFavorites(newFavorites);
  }, [favorites, saveFavorites]);

  // Clear all favorites
  const clearAllFavorites = useCallback(async (): Promise<void> => {
    setFavorites([]);
    await saveFavorites([]);
  }, [saveFavorites]);

  return {
    favorites,
    isFavorited,
    addFavorite,
    removeFavorite,
    clearAllFavorites,
    favoritesCount: favorites.length,
    isLoading
  };
}; 