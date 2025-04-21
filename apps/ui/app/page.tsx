import Link from 'next/link';
import { BrainCircuit, MessageSquare, Clock, Database } from 'lucide-react';

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Chloe</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Your autonomous agent assistant powered by LangChain.js and LangGraph
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card flex flex-col items-center">
          <div className="p-4 bg-primary-100 dark:bg-primary-900 rounded-full mb-4">
            <MessageSquare size={32} className="text-primary-600 dark:text-primary-300" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Chat with Chloe</h2>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
            Have a conversation with Chloe. She has memory and can recall past interactions.
          </p>
          <Link href="/chat" className="btn btn-primary mt-auto">
            Start chatting
          </Link>
        </div>

        <div className="card flex flex-col items-center">
          <div className="p-4 bg-secondary-100 dark:bg-secondary-900 rounded-full mb-4">
            <BrainCircuit size={32} className="text-secondary-600 dark:text-secondary-300" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Memory & Knowledge</h2>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
            View and search through Chloe's memory and knowledge base.
          </p>
          <Link href="/memory" className="btn btn-secondary mt-auto">
            Explore memory
          </Link>
        </div>

        <div className="card flex flex-col items-center">
          <div className="p-4 bg-amber-100 dark:bg-amber-900 rounded-full mb-4">
            <Clock size={32} className="text-amber-600 dark:text-amber-300" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Task Management</h2>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
            View and manage tasks that Chloe is working on or has scheduled.
          </p>
          <Link href="/tasks" className="btn btn-outline mt-auto">
            View tasks
          </Link>
        </div>

        <div className="card flex flex-col items-center">
          <div className="p-4 bg-emerald-100 dark:bg-emerald-900 rounded-full mb-4">
            <Database size={32} className="text-emerald-600 dark:text-emerald-300" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">System Status</h2>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
            Check the status of the Chloe agent system and connected services.
          </p>
          <Link href="/status" className="btn btn-outline mt-auto">
            Check status
          </Link>
        </div>
      </div>
      
      <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">About Chloe</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Chloe is an autonomous agent built with modern AI technology. She can:
        </p>
        <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 mb-4">
          <li>Maintain conversations with context and memory</li>
          <li>Run background tasks and scheduled workflows</li>
          <li>Search the web for information</li>
          <li>Learn from interactions and improve over time</li>
        </ul>
        <p className="text-gray-600 dark:text-gray-300">
          Built with Node.js, LangChain.js, LangGraph, and Qdrant for vector storage.
        </p>
      </div>
    </div>
  );
} 