import React from 'react';
import { MemoryItem } from '../../types';
import MemoryTable from '../../components/MemoryTable';

interface MemoryTabProps {
  isLoadingMemories: boolean;
  allMemories: MemoryItem[];
}

const MemoryTab: React.FC<MemoryTabProps> = ({
  isLoadingMemories,
  allMemories,
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Memory Explorer</h2>
      {isLoadingMemories ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <MemoryTable memories={allMemories} />
      )}
    </div>
  );
};

export default MemoryTab; 