'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Use dynamic import for the MarkdownViewer to avoid issues with server components
const MarkdownViewer = dynamic(() => import('./MarkdownViewer'), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-gray-400">Loading markdown explorer...</div>
});

export default function MarkdownKnowledgeTab() {
  return (
    <div>
      <MarkdownViewer />
    </div>
  );
} 