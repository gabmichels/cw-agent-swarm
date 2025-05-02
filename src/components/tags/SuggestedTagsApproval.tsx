import React, { useState } from 'react';
import { Tag, Check, X, Plus, Edit } from 'lucide-react';

interface SuggestedTagsApprovalProps {
  memoryId: string;
  suggestedTags: string[];
  existingTags: string[];
  onApprove: (memoryId: string, approvedTags: string[]) => void;
  onReject: (memoryId: string) => void;
}

/**
 * Component for displaying and approving auto-generated tags
 */
const SuggestedTagsApproval: React.FC<SuggestedTagsApprovalProps> = ({
  memoryId,
  suggestedTags,
  existingTags,
  onApprove,
  onReject
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([...suggestedTags]);
  const [isEditing, setIsEditing] = useState(false);
  const [newTag, setNewTag] = useState('');

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Add a custom tag
  const addTag = () => {
    if (newTag && !selectedTags.includes(newTag)) {
      setSelectedTags([...selectedTags, newTag]);
      setNewTag('');
    }
  };

  // Handle approval of selected tags
  const handleApprove = () => {
    onApprove(memoryId, selectedTags);
  };

  // Render tag pills
  const renderTag = (tag: string, isSelected: boolean) => (
    <div 
      key={tag}
      onClick={() => toggleTag(tag)}
      className={`flex items-center px-2 py-1 rounded-full text-xs cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      <span>{tag}</span>
      {isSelected && <Check className="ml-1 h-3 w-3" />}
    </div>
  );

  return (
    <div className="border border-gray-700 rounded-md p-3 bg-gray-800 mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center text-sm text-blue-400">
          <Tag className="h-4 w-4 mr-1" />
          <span>AI-Suggested Tags</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-gray-400 hover:text-white"
            title={isEditing ? "Done editing" : "Edit tags"}
          >
            <Edit className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tag selection area */}
      <div className="flex flex-wrap gap-2 mb-3">
        {suggestedTags.map(tag => renderTag(tag, selectedTags.includes(tag)))}
      </div>

      {/* Editing interface */}
      {isEditing && (
        <div className="mt-2">
          <div className="flex items-center">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-l px-2 py-1 text-sm text-white"
              placeholder="Add custom tag..."
            />
            <button
              onClick={addTag}
              disabled={!newTag}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-r text-sm disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end mt-3 space-x-2">
        <button
          onClick={() => onReject(memoryId)}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-sm rounded text-gray-300 flex items-center"
        >
          <X className="h-3 w-3 mr-1" />
          Ignore
        </button>
        <button
          onClick={handleApprove}
          disabled={selectedTags.length === 0}
          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-sm rounded text-white flex items-center disabled:opacity-50"
        >
          <Check className="h-3 w-3 mr-1" />
          Approve
        </button>
      </div>
    </div>
  );
};

export default SuggestedTagsApproval; 