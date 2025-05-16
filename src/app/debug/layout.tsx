'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Home, Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function DebugLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            <span>CW Agent Swarm Debug</span>
          </h1>
          
          <nav>
            <ul className="flex space-x-4">
              <li>
                <Link 
                  href="/debug" 
                  className={`flex items-center px-3 py-2 rounded ${
                    pathname === '/debug' ? 'bg-blue-800' : 'hover:bg-gray-700'
                  }`}
                >
                  <Home className="h-4 w-4 mr-2" />
                  <span>Dashboard</span>
                </Link>
              </li>
              <li>
                <Link 
                  href="/visualizations" 
                  className={`flex items-center px-3 py-2 rounded ${
                    pathname === '/visualizations' ? 'bg-blue-800' : 'hover:bg-gray-700'
                  }`}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  <span>Visualizations</span>
                </Link>
              </li>
              <li>
                <Link 
                  href="/" 
                  className="flex items-center px-3 py-2 rounded hover:bg-gray-700"
                >
                  <span>Exit Debug Mode</span>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="bg-gray-800 border-t border-gray-700 py-3 px-4 text-center text-gray-400 text-sm">
        CW Agent Swarm Debug Tools &middot; Built with visualization diagnostics
      </footer>
    </div>
  );
} 