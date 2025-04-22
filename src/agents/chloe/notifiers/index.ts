// Base interface for notification systems
export interface Notifier {
  name: string;
  initialize(): Promise<boolean>;
  send(message: string): Promise<boolean>;
  shutdown?(): Promise<void>;
}

export * from './discord'; 