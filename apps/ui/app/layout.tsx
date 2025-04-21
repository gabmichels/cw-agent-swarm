import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Chloe - Autonomous Agent Assistant',
  description: 'Interact with Chloe, your autonomous agent assistant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <header className="bg-primary-700 text-white p-4">
            <div className="container mx-auto flex justify-between items-center">
              <h1 className="text-xl font-bold">Chloe Agent</h1>
              <nav>
                <ul className="flex space-x-4">
                  <li><a href="/" className="hover:underline">Home</a></li>
                  <li><a href="/chat" className="hover:underline">Chat</a></li>
                  <li><a href="/memory" className="hover:underline">Memory</a></li>
                  <li><a href="/tasks" className="hover:underline">Tasks</a></li>
                </ul>
              </nav>
            </div>
          </header>
          
          <main className="flex-grow container mx-auto p-4">
            {children}
          </main>
          
          <footer className="bg-gray-100 dark:bg-gray-800 p-4">
            <div className="container mx-auto text-center text-sm text-gray-600 dark:text-gray-400">
              <p>Chloe - Powered by LangChain.js + LangGraph</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
} 