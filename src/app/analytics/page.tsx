import Link from 'next/link';

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/analytics/performance-review">
          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md cursor-pointer">
            <h2 className="text-xl font-semibold mb-2">Performance Review</h2>
            <p className="text-gray-600">
              Run performance reviews to analyze agent metrics and trigger self-improvement mechanisms.
            </p>
          </div>
        </Link>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border opacity-50">
          <h2 className="text-xl font-semibold mb-2">Memory Insights</h2>
          <p className="text-gray-600">
            Analyze memory usage patterns and knowledge graph connections (Coming soon).
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border opacity-50">
          <h2 className="text-xl font-semibold mb-2">Task Performance</h2>
          <p className="text-gray-600">
            Analyze task completion rates and performance metrics (Coming soon).
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border opacity-50">
          <h2 className="text-xl font-semibold mb-2">User Preference Modeling</h2>
          <p className="text-gray-600">
            View and edit learned user preferences (Coming soon).
          </p>
        </div>
      </div>
    </div>
  );
} 