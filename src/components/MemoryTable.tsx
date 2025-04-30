import React, { useState } from 'react';
import { MemoryItem } from '../types';

interface MemoryTableProps {
  memories: MemoryItem[];
}

const MemoryTable: React.FC<MemoryTableProps> = ({ memories }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [sortField, setSortField] = useState<keyof MemoryItem>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleCategoryChange = (cat: string) => {
    setCategoryFilter(cat);
  };

  const handleTagChange = (tag: string) => {
    setTagFilter(tag);
  };

  const handleSort = (field: keyof MemoryItem) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter memories based on search, category, and tags
  const filteredMemories = memories.filter((memory) => {
    const matchesSearch = search === '' || 
      (memory.content && memory.content.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = categoryFilter === '' || 
      (memory.category && memory.category === categoryFilter);
    
    const matchesTag = tagFilter === '' || 
      (memory.tags && memory.tags.includes(tagFilter));
    
    return matchesSearch && matchesCategory && matchesTag;
  });

  // Sort memories based on sortField and sortOrder
  const sortedMemories = [...filteredMemories].sort((a, b) => {
    const fieldA = a[sortField];
    const fieldB = b[sortField];
    
    if (fieldA === undefined && fieldB === undefined) return 0;
    if (fieldA === undefined) return sortOrder === 'asc' ? 1 : -1;
    if (fieldB === undefined) return sortOrder === 'asc' ? -1 : 1;
    
    if (typeof fieldA === 'string' && typeof fieldB === 'string') {
      return sortOrder === 'asc' 
        ? fieldA.localeCompare(fieldB)
        : fieldB.localeCompare(fieldA);
    }
    
    if (typeof fieldA === 'number' && typeof fieldB === 'number') {
      return sortOrder === 'asc' 
        ? fieldA - fieldB
        : fieldB - fieldA;
    }
    
    return 0;
  });

  // Get unique categories for filtering
  const categories = Array.from(new Set(memories
    .map(m => m.category)
    .filter(Boolean) as string[]
  ));

  // Get unique tags for filtering
  const tags = Array.from(new Set(
    memories.flatMap(m => m.tags || [])
  ));

  return (
    <div className="overflow-auto">
      <div className="flex space-x-2 mb-2">
        <input
          type="text"
          placeholder="Search memories..."
          value={search}
          onChange={handleSearch}
          className="border p-1 rounded"
        />
        <select 
          value={categoryFilter} 
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="">All Categories</option>
          {categories.map((cat, index) => (
            <option key={index} value={cat}>{cat}</option>
          ))}
        </select>
        <select 
          value={tagFilter} 
          onChange={(e) => handleTagChange(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="">All Tags</option>
          {tags.map((tag, tagIdx) => (
            <option key={tagIdx} value={tag}>{tag}</option>
          ))}
        </select>
      </div>
      
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th onClick={() => handleSort('timestamp')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
              Timestamp {sortField === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('content')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
              Content {sortField === 'content' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('category')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
              Category {sortField === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('importance')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
              Importance {sortField === 'importance' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tags
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedMemories.length > 0 ? (
            sortedMemories.map((memory, index) => (
              <tr key={memory.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {memory.timestamp || memory.created || 'Unknown date'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {memory.content || 'No content'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {memory.category || 'Uncategorized'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {memory.importance !== undefined ? memory.importance : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {memory.tags && memory.tags.length > 0 
                    ? memory.tags.join(', ') 
                    : 'No tags'}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                No memories found matching the current filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MemoryTable; 