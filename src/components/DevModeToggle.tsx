import React from 'react';
import { BrainCog, Eye, EyeOff } from 'lucide-react';
import { toggleMessageDebugging } from '../utils/messageDebug';

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

  // Handle toggle with direct localStorage update
  const handleToggleDevMode = () => {
    const newValue = !showInternalMessages;
    setShowInternalMessages(newValue);
    toggleMessageDebugging(newValue);
    console.log(`Dev mode toggled to: ${newValue}`);
    
    // Force reload if turning dev mode off to clear any lingering internal messages
    if (!newValue) {
      console.log('Reloading to clear internal messages...');
      setTimeout(() => window.location.reload(), 100);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={handleToggleDevMode}
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