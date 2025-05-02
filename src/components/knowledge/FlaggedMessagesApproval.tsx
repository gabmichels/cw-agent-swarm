import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Tag, Filter, Trash, Check, X, Tag as TagIcon, MessageSquare, Brain, User } from 'lucide-react';

interface FlaggedMessage {
  id: string;
  content: string;
  type: string;
  timestamp: string;
  tags: string[];
  user?: string;
  flaggedBy?: string;
  flaggedAt?: string;
}

const FlaggedMessagesApproval: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<FlaggedMessage[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    type: '',
    tag: '',
    user: ''
  });
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Load flagged messages
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        // In a real implementation, this would call the API with filters
        const response = await fetch('/api/memory/flagged');
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
          
          // Extract unique tags for filtering
          const tags = new Set<string>();
          data.messages.forEach((msg: FlaggedMessage) => {
            msg.tags?.forEach(tag => tags.add(tag));
          });
          setAvailableTags(Array.from(tags).sort());
        } else {
          console.error('Failed to fetch flagged messages');
        }
      } catch (error) {
        console.error('Error fetching flagged messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, []);

  // Filter messages based on selected filters
  const filteredMessages = messages.filter(message => {
    const typeMatch = !filters.type || message.type === filters.type;
    const tagMatch = !filters.tag || (message.tags && message.tags.includes(filters.tag));
    const userMatch = !filters.user || message.user === filters.user || message.flaggedBy === filters.user;
    return typeMatch && tagMatch && userMatch;
  });

  // Get unique users for the filter dropdown
  const uniqueUsers = Array.from(new Set(messages.flatMap(m => [m.user, m.flaggedBy].filter(Boolean) as string[])));

  // Handle select/deselect all
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(filteredMessages.map(m => m.id)));
    }
    setAllSelected(!allSelected);
  };

  // Toggle single message selection
  const toggleMessageSelection = (id: string) => {
    const newSelection = new Set(selectedMessages);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedMessages(newSelection);
    
    // Update allSelected state
    setAllSelected(newSelection.size === filteredMessages.length);
  };

  // Add a tag to bulk operation
  const addBulkTag = () => {
    if (newTagInput && !bulkTags.includes(newTagInput)) {
      setBulkTags([...bulkTags, newTagInput]);
      setNewTagInput('');
    }
  };

  // Remove a tag from bulk operation
  const removeBulkTag = (tag: string) => {
    setBulkTags(bulkTags.filter(t => t !== tag));
  };

  // Apply bulk tags to selected messages
  const applyBulkTags = async () => {
    if (selectedMessages.size === 0 || bulkTags.length === 0) return;
    
    setIsProcessing(true);
    try {
      // In a real implementation, call the API to update tags
      const selectedIds = Array.from(selectedMessages);
      const response = await fetch('/api/memory/bulk-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, tags: bulkTags })
      });
      
      if (response.ok) {
        // Update local state
        setMessages(messages.map(message => {
          if (selectedMessages.has(message.id)) {
            // Add new tags without duplicates
            const currentTags = message.tags || [];
            const updatedTags = Array.from(new Set([...currentTags, ...bulkTags]));
            return { ...message, tags: updatedTags };
          }
          return message;
        }));
        
        // Add new tags to available tags
        setAvailableTags(Array.from(new Set([...availableTags, ...bulkTags])));
        
        // Clear bulk tags
        setBulkTags([]);
        alert(`Tags applied to ${selectedMessages.size} messages`);
      } else {
        console.error('Failed to apply bulk tags');
        alert('Failed to apply tags. Please try again.');
      }
    } catch (error) {
      console.error('Error applying bulk tags:', error);
      alert('An error occurred while applying tags');
    } finally {
      setIsProcessing(false);
    }
  };

  // Approve selected messages for knowledge storage
  const approveSelected = async () => {
    if (selectedMessages.size === 0) return;
    
    const confirmMessage = `Are you sure you want to approve ${selectedMessages.size} messages for permanent knowledge storage?`;
    if (!window.confirm(confirmMessage)) return;
    
    setIsProcessing(true);
    try {
      // In a real implementation, call the API to approve messages
      const selectedIds = Array.from(selectedMessages);
      const response = await fetch('/api/memory/add-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ids: selectedIds,
          addTags: bulkTags.length > 0 ? bulkTags : undefined
        })
      });
      
      if (response.ok) {
        // Remove approved messages from the list
        setMessages(messages.filter(message => !selectedMessages.has(message.id)));
        setSelectedMessages(new Set());
        setBulkTags([]);
        alert(`${selectedIds.length} messages approved and added to knowledge base`);
      } else {
        console.error('Failed to approve messages');
        alert('Failed to approve messages. Please try again.');
      }
    } catch (error) {
      console.error('Error approving messages:', error);
      alert('An error occurred while approving messages');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete selected messages
  const deleteSelected = async () => {
    if (selectedMessages.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedMessages.size} flagged messages?`;
    if (!window.confirm(confirmMessage)) return;
    
    setIsProcessing(true);
    try {
      // In a real implementation, call the API to delete messages
      const selectedIds = Array.from(selectedMessages);
      const response = await fetch('/api/memory/flagged', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      
      if (response.ok) {
        // Remove deleted messages from the list
        setMessages(messages.filter(message => !selectedMessages.has(message.id)));
        setSelectedMessages(new Set());
        alert(`${selectedIds.length} messages deleted`);
      } else {
        console.error('Failed to delete messages');
        alert('Failed to delete messages. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting messages:', error);
      alert('An error occurred while deleting messages');
    } finally {
      setIsProcessing(false);
    }
  };

  // Get icon for message type
  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      case 'thought':
      case 'reflection':
        return <Brain className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // Format timestamp
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Flagged Messages Approval</h2>
      
      {/* Filtering Controls */}
      <div className="bg-gray-700 p-4 rounded-lg mb-4">
        <div className="flex items-center mb-3">
          <Filter className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-md font-medium">Filter Messages</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Type filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Message Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({...filters, type: e.target.value})}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              <option value="message">Message</option>
              <option value="thought">Thought</option>
              <option value="reflection">Reflection</option>
            </select>
          </div>
          
          {/* Tag filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tag</label>
            <select
              value={filters.tag}
              onChange={(e) => setFilters({...filters, tag: e.target.value})}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="">All Tags</option>
              {availableTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
          
          {/* User filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">User</label>
            <select
              value={filters.user}
              onChange={(e) => setFilters({...filters, user: e.target.value})}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="">All Users</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Bulk Operations Panel */}
      <div className="bg-gray-700 p-4 rounded-lg mb-4">
        <div className="flex items-center mb-3">
          <TagIcon className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-md font-medium">Bulk Operations</h3>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          {/* Tag input */}
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">Add Tags to Selected</label>
            <div className="flex">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Enter tag name"
                className="flex-1 bg-gray-800 border border-gray-600 rounded-l px-3 py-2 text-sm"
                onKeyPress={(e) => e.key === 'Enter' && addBulkTag()}
              />
              <button
                onClick={addBulkTag}
                disabled={!newTagInput}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-r text-sm disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            
            {/* Tag list */}
            {bulkTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {bulkTags.map(tag => (
                  <span
                    key={tag}
                    className="bg-blue-900/60 text-blue-200 text-xs rounded-full px-2 py-1 flex items-center"
                  >
                    {tag}
                    <button
                      onClick={() => removeBulkTag(tag)}
                      className="ml-1.5 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex items-end gap-2">
            <button
              onClick={applyBulkTags}
              disabled={selectedMessages.size === 0 || bulkTags.length === 0 || isProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <Tag className="h-4 w-4 mr-1" />
              Apply Tags
            </button>
            
            <button
              onClick={approveSelected}
              disabled={selectedMessages.size === 0 || isProcessing}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </button>
            
            <button
              onClick={deleteSelected}
              disabled={selectedMessages.size === 0 || isProcessing}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <Trash className="h-4 w-4 mr-1" />
              Delete
            </button>
          </div>
        </div>
        
        {/* Selection stats */}
        <div className="mt-3 text-sm text-gray-400">
          {selectedMessages.size > 0 ? (
            <span>{selectedMessages.size} of {filteredMessages.length} messages selected</span>
          ) : (
            <span>Select messages to perform actions</span>
          )}
        </div>
      </div>
      
      {/* Messages List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="bg-gray-700 rounded-lg p-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-500" />
          <p className="text-gray-400">No flagged messages found matching the current filters.</p>
        </div>
      ) : (
        <div>
          <div className="bg-gray-700 rounded-lg overflow-hidden">
            <div className="border-b border-gray-600 p-3 flex items-center bg-gray-750">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="mr-3 h-4 w-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">
                  {filteredMessages.length} {filteredMessages.length === 1 ? 'message' : 'messages'}
                </span>
              </div>
            </div>
            
            <div className="divide-y divide-gray-600 max-h-[600px] overflow-auto">
              {filteredMessages.map(message => (
                <div key={message.id} className="p-3 hover:bg-gray-750">
                  <div className="flex">
                    <div className="mr-3">
                      <input
                        type="checkbox"
                        checked={selectedMessages.has(message.id)}
                        onChange={() => toggleMessageSelection(message.id)}
                        className="h-4 w-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center mb-1 gap-2">
                        {getTypeIcon(message.type)}
                        <span className="text-sm font-medium">
                          {message.type.charAt(0).toUpperCase() + message.type.slice(1)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(message.timestamp)}
                        </span>
                        
                        {message.user && (
                          <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full flex items-center ml-auto">
                            <User className="h-3 w-3 mr-1" />
                            {message.user}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm bg-gray-800 p-2 rounded mb-2 whitespace-pre-wrap">
                        {message.content}
                      </div>
                      
                      {/* Tags */}
                      {message.tags && message.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {message.tags.map(tag => (
                            <span
                              key={tag}
                              className="bg-gray-600 text-gray-300 text-xs px-2 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlaggedMessagesApproval; 