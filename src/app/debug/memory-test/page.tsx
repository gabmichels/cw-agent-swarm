'use client';

import { useState } from 'react';

export default function MemoryTestPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/debug/memory-inspect');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to inspect memory');
      }
      
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🔍 Memory Content Inspector</h1>
        <p className="text-gray-600 mb-4">
          This tool helps verify what personal information is actually stored in your agent's memory system.
        </p>
        
        <button
          onClick={runTest}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Inspecting Memory...' : 'Inspect Memory Content'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-3">📊 Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {results.analysis.documentMemoriesFound}
                </div>
                <div className="text-sm text-gray-600">Total Documents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {results.analysis.criticalMemoriesFound}
                </div>
                <div className="text-sm text-gray-600">Critical Memories</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {results.analysis.summary.totalMemoriesWithContent}
                </div>
                <div className="text-sm text-gray-600">With Content</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${results.analysis.summary.hasPersonalInformation ? 'text-red-600' : 'text-green-600'}`}>
                  {results.analysis.summary.hasPersonalInformation ? 'YES' : 'NO'}
                </div>
                <div className="text-sm text-gray-600">Personal Info</div>
              </div>
            </div>
          </div>

          {/* Critical Memories */}
          {results.analysis.criticalMemories.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-3 text-red-800">🔐 Critical Memories</h2>
              <div className="space-y-3">
                {results.analysis.criticalMemories.map((memory: any, index: number) => (
                  <div key={memory.id} className="bg-white border border-red-200 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium">Critical Memory #{index + 1}</h3>
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        {memory.contentLength} chars
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>File:</strong> {memory.fileName || 'Unknown'}
                    </div>
                    <div className="text-sm bg-gray-100 p-2 rounded font-mono">
                      {memory.contentPreview}...
                    </div>
                    <div className="mt-2 space-x-4 text-xs">
                      <span className={memory.hasContactInfo ? 'text-red-600' : 'text-green-600'}>
                        Contact Info: {memory.hasContactInfo ? 'YES' : 'NO'}
                      </span>
                      <span className={memory.hasPersonalDetails ? 'text-red-600' : 'text-green-600'}>
                        Personal Details: {memory.hasPersonalDetails ? 'YES' : 'NO'}
                      </span>
                      <span className={memory.hasAddresses ? 'text-red-600' : 'text-green-600'}>
                        Addresses: {memory.hasAddresses ? 'YES' : 'NO'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Query Test Results */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-3">🔍 Query Test Results</h2>
            <div className="space-y-3">
              {Object.entries(results.analysis.queryTests).map(([query, result]: [string, any]) => (
                <div key={query} className="bg-white border border-gray-200 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">"{query}"</h3>
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {result.count} results
                    </span>
                  </div>
                  {result.error && (
                    <div className="text-red-600 text-sm">Error: {result.error}</div>
                  )}
                  {result.results && result.results.length > 0 && (
                    <div className="space-y-2">
                      {result.results.map((r: any, i: number) => (
                        <div key={i} className="text-sm bg-gray-100 p-2 rounded">
                          <div className="font-mono mb-1">{r.contentPreview}...</div>
                          <div className="text-xs space-x-2">
                            <span className={r.critical ? 'text-red-600' : 'text-gray-600'}>
                              Critical: {r.critical ? 'YES' : 'NO'}
                            </span>
                            <span className={r.hasContactInfo ? 'text-red-600' : 'text-gray-600'}>
                              Contact: {r.hasContactInfo ? 'YES' : 'NO'}
                            </span>
                            <span className={r.hasPersonalInfo ? 'text-red-600' : 'text-gray-600'}>
                              Personal: {r.hasPersonalInfo ? 'YES' : 'NO'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Document Memories */}
          {results.analysis.documentMemories.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-3">📄 Document Memories (Sample)</h2>
              <div className="space-y-3">
                {results.analysis.documentMemories.map((memory: any, index: number) => (
                  <div key={memory.id} className="bg-white border border-yellow-200 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium">Document #{index + 1}</h3>
                      <div className="text-xs space-x-2">
                        <span className={`px-2 py-1 rounded ${memory.critical ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          {memory.critical ? 'Critical' : 'Normal'}
                        </span>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {memory.contentLength} chars
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>File:</strong> {memory.fileName || 'Unknown'}
                    </div>
                    <div className="text-sm bg-gray-100 p-2 rounded font-mono">
                      {memory.contentPreview}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Data */}
          <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer">🔧 Raw Data (for debugging)</summary>
            <pre className="mt-3 text-xs bg-white p-3 rounded border overflow-auto max-h-96">
              {JSON.stringify(results, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
} 