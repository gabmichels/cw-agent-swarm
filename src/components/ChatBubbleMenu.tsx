import { Bookmark, ChevronLeft, ChevronRight, Copy, Database, FileText, Loader2, RefreshCw, Reply, Star, ThumbsDown, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Toast } from '../components/ui/toast';
import { BookmarkService } from '../services/message/BookmarkService';
import { ExportService } from '../services/message/ExportService';
import { ImportanceService } from '../services/message/ImportanceService';
import { KnowledgeService } from '../services/message/KnowledgeService';
import { MessageActionHandler } from '../services/message/MessageActionHandler';
import { MessageImportance, MessageReliability } from '../services/message/MessageActionService';
import { RegenerationService } from '../services/message/RegenerationService';
import { ReliabilityService } from '../services/message/ReliabilityService';
import { Message } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tooltip } from './ui/tooltip';

interface ChatBubbleMenuProps {
  message: Message;
  isAssistantMessage: boolean;
  showVersionControls?: boolean;
  currentVersionIndex?: number;
  totalVersions?: number;
  onPreviousVersion?: () => void;
  onNextVersion?: () => void;
  onCopyText: (text: string) => void;
  onFlagUnreliable: (content: string) => Promise<void>;
  onRegenerate: (content: string) => Promise<void>;
  onFlagImportant: (content: string) => Promise<void>;
  onAddToKnowledge: (content: string) => Promise<void>;
  onExportToCoda: (content: string) => Promise<void>;
  onDeleteMessage?: (timestamp: Date) => Promise<boolean>;
  onReplyToMessage?: (message: Message) => void;
  onBookmarkMessage?: (messageId: string, isBookmarked: boolean) => Promise<void>;
  messageId?: string;
  onDeleteMemory?: () => Promise<void>;
}

interface ActionState {
  isLoading: boolean;
  error: string | null;
}

const ChatBubbleMenu: React.FC<ChatBubbleMenuProps> = ({
  message,
  isAssistantMessage,
  showVersionControls = false,
  currentVersionIndex = 0,
  totalVersions = 1,
  onPreviousVersion,
  onNextVersion,
  onCopyText,
  onFlagUnreliable,
  onRegenerate,
  onFlagImportant,
  onAddToKnowledge,
  onExportToCoda,
  onDeleteMessage,
  onReplyToMessage,
  onBookmarkMessage,
  messageId,
  onDeleteMemory
}) => {
  // Initialize services
  const [messageActionHandler] = useState(() => new MessageActionHandler());
  const [importanceService] = useState(() => new ImportanceService({
    onImportanceChange: (messageId, importance) => {
      showToast(importance === MessageImportance.HIGH 
        ? 'Message marked as highly important' 
        : 'Message importance updated');
    }
  }));
  const [knowledgeService] = useState(() => new KnowledgeService({
    onKnowledgeAdded: () => showToast('Added to knowledge base')
  }));
  const [regenerationService] = useState(() => new RegenerationService({
    onRegenerationStarted: () => showToast('Regenerating message...'),
    onRegenerationComplete: () => showToast('Message regenerated'),
    onRegenerationError: (_, error) => showToast(`Regeneration failed: ${error}`)
  }));
  const [exportService] = useState(() => new ExportService({
    onExportComplete: (_, platform, url) => {
      showToast(`Exported to ${platform}`);
      window.open(url, '_blank');
    }
  }));
  const [reliabilityService] = useState(() => new ReliabilityService({
    onReliabilityChange: (_, reliability) => {
      showToast(reliability === MessageReliability.UNRELIABLE 
        ? 'Message marked as unreliable' 
        : 'Message reliability updated');
    }
  }));
  const [bookmarkService] = useState(() => new BookmarkService({
    onBookmarkChange: (messageId, isBookmarked) => {
      showToast(isBookmarked ? 'Message bookmarked' : 'Bookmark removed');
    }
  }));

  // Action states
  const [copyState, setCopyState] = useState<ActionState>({ isLoading: false, error: null });
  const [importanceState, setImportanceState] = useState<ActionState>({ isLoading: false, error: null });
  const [knowledgeState, setKnowledgeState] = useState<ActionState>({ isLoading: false, error: null });
  const [regenerationState, setRegenerationState] = useState<ActionState>({ isLoading: false, error: null });
  const [exportState, setExportState] = useState<ActionState>({ isLoading: false, error: null });
  const [reliabilityState, setReliabilityState] = useState<ActionState>({ isLoading: false, error: null });
  const [deleteState, setDeleteState] = useState<ActionState>({ isLoading: false, error: null });
  const [bookmarkState, setBookmarkState] = useState<ActionState>({ isLoading: false, error: null });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Track bookmark status - check if message has bookmark metadata
  const [isBookmarked, setIsBookmarked] = useState(() => {
    return message.metadata?.isBookmark || false;
  });

  // Load actual bookmark status from API on mount
  useEffect(() => {
    if (message.id) {
      bookmarkService.getMessageBookmarkStatus(message.id).then(status => {
        setIsBookmarked(status);
      });
    }
  }, [message.id, bookmarkService]);

  // Action handlers
  const handleCopy = useCallback(async () => {
    setCopyState({ isLoading: true, error: null });
    try {
      const result = await messageActionHandler.copyMessage({
        content: message.content || ''
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Add toast notification for successful copy
      showToast('Message copied');
      
      // Update the UI state to show the callback worked
      onCopyText(message.content || '');
    } catch (error) {
      setCopyState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to copy'
      });
    } finally {
      setCopyState({ isLoading: false, error: null });
    }
  }, [message.content, messageActionHandler]);

  const handleFlagImportant = useCallback(async () => {
    setImportanceState({ isLoading: true, error: null });
    try {
      const result = await importanceService.flagImportance({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || '',
        importance: MessageImportance.HIGH
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setImportanceState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to flag importance'
      });
    } finally {
      setImportanceState({ isLoading: false, error: null });
    }
  }, [message, importanceService]);

  const handleAddToKnowledge = useCallback(async () => {
    setKnowledgeState({ isLoading: true, error: null });
    try {
      const result = await knowledgeService.addToKnowledge({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || ''
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setKnowledgeState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add to knowledge base'
      });
    } finally {
      setKnowledgeState({ isLoading: false, error: null });
    }
  }, [message, knowledgeService]);

  const handleRegenerate = useCallback(async () => {
    setRegenerationState({ isLoading: true, error: null });
    try {
      const result = await regenerationService.regenerateMessage({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || ''
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setRegenerationState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to regenerate message'
      });
    } finally {
      setRegenerationState({ isLoading: false, error: null });
    }
  }, [message, regenerationService]);

  const handleExportToCoda = useCallback(async () => {
    setExportState({ isLoading: true, error: null });
    try {
      const result = await exportService.exportToCoda({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || ''
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setExportState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to export to Coda'
      });
    } finally {
      setExportState({ isLoading: false, error: null });
    }
  }, [message, exportService]);

  const handleFlagUnreliable = useCallback(async () => {
    setReliabilityState({ isLoading: true, error: null });
    try {
      const result = await reliabilityService.flagReliability({
        messageId: message.id || '',
        timestamp: message.timestamp || new Date(),
        content: message.content || '',
        reliability: MessageReliability.UNRELIABLE
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      setReliabilityState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to flag reliability'
      });
    } finally {
      setReliabilityState({ isLoading: false, error: null });
    }
  }, [message, reliabilityService]);

  const handleDelete = useCallback(async () => {
    setDeleteState({ isLoading: true, error: null });
    try {
      // Call the API endpoint directly
      const response = await fetch(`/api/chat/message?${message.id ? `messageId=${message.id}` : `timestamp=${message.timestamp?.toISOString()}`}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        // Try to call the parent handler to update UI, but don't fail if it's not available or fails
        if (onDeleteMessage && message.timestamp) {
          try {
            await onDeleteMessage(message.timestamp);
          } catch (e) {
            console.warn('UI update callback failed, but message was deleted:', e);
          }
        }
        
        // Create a more informative success message
        const thoughtsCount = data.deletedThoughtsCount || 0;
        const successMessage = thoughtsCount > 0 
          ? `Message and ${thoughtsCount} related thought${thoughtsCount === 1 ? '' : 's'} deleted successfully`
          : 'Message deleted successfully';
        
        Toast.show({ message: successMessage, type: 'success', duration: 3000 });
        setShowDeleteDialog(false);
        
        // Dispatch a custom event that can be listened for by parent components
        const event = new CustomEvent('messageDeleted', {
          detail: { id: message.id, timestamp: message.timestamp, deletedThoughtsCount: thoughtsCount }
        });
        document.dispatchEvent(event);
        
        // The SSE system will handle real-time UI updates, no need to reload
      } else {
        throw new Error(data.error || 'Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      setDeleteState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      Toast.show({ 
        message: 'Failed to delete message: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        type: 'error',
        duration: 5000 
      });
    }
  }, [message.id, message.timestamp, onDeleteMessage]);

  const handleReply = useCallback(() => {
    if (onReplyToMessage) {
      onReplyToMessage(message);
      showToast('Message attached for reply');
    }
  }, [message, onReplyToMessage]);

  const handleBookmark = useCallback(async () => {
    if (!message.id) {
      showToast('Cannot bookmark message: ID missing');
      return;
    }
    
    setBookmarkState({ isLoading: true, error: null });
    try {
      const newBookmarkStatus = !isBookmarked;
      const result = await bookmarkService.toggleBookmark({
        messageId: message.id,
        timestamp: message.timestamp || new Date(),
        content: message.content || '',
        isBookmarked: newBookmarkStatus
      });
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setIsBookmarked(newBookmarkStatus);
      
      // Also call the parent callback if provided
      if (onBookmarkMessage) {
        await onBookmarkMessage(message.id, newBookmarkStatus);
      }
    } catch (error) {
      setBookmarkState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update bookmark'
      });
      showToast('Failed to update bookmark');
    } finally {
      setBookmarkState({ isLoading: false, error: null });
    }
  }, [message.id, message.timestamp, message.content, isBookmarked, bookmarkService, onBookmarkMessage]);

  // Toast notification
  const showToast = (message: string) => {
    Toast.show({
      message,
      type: message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') 
        ? 'error' 
        : 'success',
      duration: 3000
    });
  };

  return (
    <>
      <div className="flex flex-wrap justify-center gap-1 mt-2 text-gray-400">
        <Tooltip content="Copy text">
          <button 
            onClick={handleCopy}
            className="p-1.5 rounded-full hover:bg-gray-800 hover:text-gray-200 transition-colors"
            disabled={copyState.isLoading}
          >
            {copyState.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </Tooltip>
        
        {/* Reply button - available for all messages */}
        {onReplyToMessage && (
          <Tooltip content="Reply to this message">
            <button 
              onClick={handleReply}
              className="p-1.5 rounded-full hover:bg-gray-800 hover:text-blue-400 transition-colors"
            >
              <Reply className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
        
        {/* Bookmark button - available for all messages */}
        {message.id && (
          <Tooltip content={isBookmarked ? "Remove bookmark" : "Bookmark message"}>
            <button 
              onClick={handleBookmark}
              className={`p-1.5 rounded-full hover:bg-gray-800 transition-colors ${
                isBookmarked 
                  ? 'text-yellow-400 hover:text-yellow-300' 
                  : 'hover:text-yellow-400'
              }`}
              disabled={bookmarkState.isLoading}
            >
              {bookmarkState.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
              )}
            </button>
          </Tooltip>
        )}
        
        {isAssistantMessage && (
          <>
            <Tooltip content="Flag as unreliable">
              <button 
                onClick={handleFlagUnreliable}
                className="p-1.5 rounded-full hover:bg-gray-800 hover:text-red-400 transition-colors"
                disabled={reliabilityState.isLoading}
              >
                {reliabilityState.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsDown className="h-4 w-4" />
                )}
              </button>
            </Tooltip>
            
            <Tooltip content="Regenerate response">
              <button 
                onClick={handleRegenerate}
                className="p-1.5 rounded-full hover:bg-gray-800 hover:text-green-400 transition-colors"
                disabled={regenerationState.isLoading}
              >
                {regenerationState.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </Tooltip>
            
            {showVersionControls && (
              <div className="flex items-center ml-2 mr-2">
                <Tooltip content="Previous version">
                  <button 
                    onClick={onPreviousVersion}
                    disabled={currentVersionIndex === 0}
                    className={`p-1.5 rounded-full ${currentVersionIndex === 0 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-gray-800 hover:text-blue-400 transition-colors'}`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </Tooltip>
                
                <span className="text-xs mx-1">
                  {currentVersionIndex + 1}/{totalVersions}
                </span>
                
                <Tooltip content="Next version">
                  <button 
                    onClick={onNextVersion}
                    disabled={currentVersionIndex === totalVersions - 1}
                    className={`p-1.5 rounded-full ${currentVersionIndex === totalVersions - 1 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-gray-800 hover:text-blue-400 transition-colors'}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>
            )}
          </>
        )}
        
        <Tooltip content="Flag as important">
          <button 
            onClick={handleFlagImportant}
            className="p-1.5 rounded-full hover:bg-gray-800 hover:text-yellow-400 transition-colors"
            disabled={importanceState.isLoading}
          >
            {importanceState.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star className="h-4 w-4" />
            )}
          </button>
        </Tooltip>
        
        <Tooltip content="Add to knowledge base">
          <button 
            onClick={handleAddToKnowledge}
            className="p-1.5 rounded-full hover:bg-gray-800 hover:text-blue-400 transition-colors"
            disabled={knowledgeState.isLoading}
          >
            {knowledgeState.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
          </button>
        </Tooltip>
        
        <Tooltip content="Export to Coda">
          <button 
            onClick={handleExportToCoda}
            className="p-1.5 rounded-full hover:bg-gray-800 hover:text-purple-400 transition-colors"
            disabled={exportState.isLoading}
          >
            {exportState.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </button>
        </Tooltip>

        {onDeleteMessage && (
          <Tooltip content="Delete message">
            <button 
              onClick={() => setShowDeleteDialog(true)}
              className="p-1.5 rounded-full hover:bg-gray-800 hover:text-red-400 transition-colors"
              disabled={deleteState.isLoading}
            >
              {deleteState.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) {
            setDeleteState({ isLoading: false, error: null });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <p className="text-gray-300 mb-2">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
            <p className="text-gray-400 text-sm mb-4">
              This will also delete any related thoughts, reflections, insights, and cognitive processes associated with this message.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteState.isLoading}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 transition-colors"
              >
                {deleteState.isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChatBubbleMenu; 