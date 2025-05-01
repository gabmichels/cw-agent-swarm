'use client';

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import TagSelector from '../../components/knowledge/TagSelector';
import TaggedItemsList from '../../components/knowledge/TaggedItemsList';
import Link from 'next/link';

export default function KnowledgeTagsPage() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  return (
    <div className="container mx-auto max-w-screen-xl py-6 px-4">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/dashboard" className="text-blue-500 hover:text-blue-400">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">Knowledge Tags Explorer</h1>
        </div>
        <p className="text-gray-400">Browse and filter knowledge by tags</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <div className="bg-gray-800 rounded-lg p-4">
            <TagSelector
              selectedTags={selectedTags}
              onChange={setSelectedTags}
              maxDisplayed={30}
            />
          </div>
        </div>
        <div className="md:col-span-3">
          <TaggedItemsList 
            tags={selectedTags}
            limit={100}
          />
        </div>
      </div>
    </div>
  );
} 