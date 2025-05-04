import React from 'react';
import FilesTab from '../components/tabs/FilesTab';
import DashboardLayout from '../components/layout/DashboardLayout';

/**
 * Files page route component
 */
const FilesPage: React.FC = () => {
  return (
    <DashboardLayout>
      <FilesTab />
    </DashboardLayout>
  );
};

export default FilesPage; 