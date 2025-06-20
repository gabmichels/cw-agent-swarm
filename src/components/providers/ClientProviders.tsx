'use client';

import React from 'react';
import { NotificationToastProvider } from '../notifications/NotificationToastProvider';

interface ClientProvidersProps {
  children: React.ReactNode;
}

/**
 * Client-side providers wrapper
 * This component wraps all client-side providers to avoid server/client component conflicts
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <NotificationToastProvider
      maxToasts={5}
      enableSounds={true}
      enableBrowserNotifications={true}
    >
      {children}
    </NotificationToastProvider>
  );
} 