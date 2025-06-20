import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClientProviders } from '../components/providers/ClientProviders';

// Initialize server components - this will only run on the server
// The import itself will trigger the initialization
import '../lib/server-init';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Crowd Wisdom',
  description: 'AI Agent platform for enterprise knowledge management',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
    shortcut: '/favicon-16x16.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
      </head>
      <body className="min-h-screen bg-gray-900 text-gray-100">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
} 