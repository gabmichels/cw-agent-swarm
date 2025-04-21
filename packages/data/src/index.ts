// This package will contain data loaders and handlers for agent data

// Placeholder exports - these will be implemented when needed
export const DATA_VERSION = '0.1.0';

export interface DataSource {
  name: string;
  type: 'file' | 'database' | 'api';
  path?: string;
  url?: string;
}

export const defaultDataSources: DataSource[] = [
  {
    name: 'local-files',
    type: 'file',
    path: './data',
  }
]; 