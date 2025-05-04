import React from 'react';
import KnowledgeGraphPage from '../components/knowledge/KnowledgeGraphPage';
import DashboardLayout from '../components/layout/DashboardLayout';

const KnowledgeGraphRoute: React.FC = () => {
  return (
    <DashboardLayout>
      <div className="flex-1 overflow-auto p-6">
        <KnowledgeGraphPage />
      </div>
    </DashboardLayout>
  );
};

export default KnowledgeGraphRoute; 