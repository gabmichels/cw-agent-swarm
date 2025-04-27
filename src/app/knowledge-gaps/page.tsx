'use client';

import React from 'react';
import KnowledgeGapsPanel from '../../components/knowledge/KnowledgeGapsPanel';
import DashboardLayout from '../../components/layout/DashboardLayout';

export default function KnowledgeGapsPage() {
  return (
    <DashboardLayout>
      <KnowledgeGapsPanel />
    </DashboardLayout>
  );
} 