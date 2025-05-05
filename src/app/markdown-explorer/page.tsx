'use client';

import { Suspense } from 'react';
import ClientMarkdownViewer from '@/components/knowledge/ClientMarkdownViewer';

// This page is now a client component to avoid the SSR issues
export default function MarkdownExplorerPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4 text-white">Markdown Knowledge Explorer</h1>
      
      <Suspense fallback={<div className="text-white p-4">Loading markdown viewer...</div>}>
        <ClientMarkdownViewer />
      </Suspense>
    </div>
  );
} 