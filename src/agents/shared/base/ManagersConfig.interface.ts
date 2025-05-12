import type { ManagerConfig } from './managers/BaseManager';

export interface ManagersConfig {
  memory?: ManagerConfig;
  planning?: ManagerConfig;
  knowledge?: ManagerConfig;
  scheduler?: ManagerConfig;
  reflection?: ManagerConfig;
  tools?: ManagerConfig;
  [key: string]: ManagerConfig | undefined;
} 