'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Use dynamic import without ssr: false since this is a client component already
const MarkdownViewer = dynamic(
  () => import('./MarkdownViewer'),
  {
    loading: () => <div className="p-8 text-center text-gray-400">Loading markdown explorer...</div>
  }
);

export default function ClientMarkdownViewer() {
  return <MarkdownViewer />;
} 