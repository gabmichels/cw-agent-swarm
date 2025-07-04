import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Agent Monitor - Agent Core Platform',
  description: 'Real-time monitoring dashboard for agent activities',
};

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="bg-gray-900 min-h-screen flex flex-col">
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <img 
                  src="/assets/images/cw_fulltext.svg" 
                  alt="Crowd Wisdom" 
                  className="h-8 hover:opacity-80 transition-opacity cursor-pointer" 
                />
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/agents" 
                className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link 
                href="/agents/ethics" 
                className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Ethics Monitor
              </Link>
              <Link 
                href="/agents/register" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Register Agent
              </Link>
            </div>
          </div>
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </section>
  );
} 