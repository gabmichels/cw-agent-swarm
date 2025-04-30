import React from 'react';
import { BrainCog, Eye, EyeOff } from 'lucide-react';

interface DevModeToggleProps {
  showInternalMessages: boolean;
  setShowInternalMessages: (show: boolean) => void;
}

const DevModeToggle: React.FC<DevModeToggleProps> = ({ 
  showInternalMessages, 
  setShowInternalMessages 
}) => {
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development' && !process.env.DEV_SHOW_INTERNAL_MESSAGES) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={() => setShowInternalMessages(!showInternalMessages)}
        className={`flex items-center px-3 py-2 rounded-full shadow-lg transition-colors
          ${showInternalMessages 
            ? 'bg-amber-600 text-white' 
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        title={showInternalMessages ? 'Hide internal messages' : 'Show internal messages (dev mode)'}
      >
        <BrainCog size={16} className="mr-2" />
        {showInternalMessages ? (
          <>
            <span className="mr-2">Dev Mode</span>
            <Eye size={14} />
          </>
        ) : (
          <>
            <span className="mr-2">Dev Mode</span>
            <EyeOff size={14} />
          </>
        )}
      </button>
    </div>
  );
};

export default DevModeToggle; 