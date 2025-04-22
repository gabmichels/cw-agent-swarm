import ChatInterface from '@/components/ChatInterface';

export default function ChatPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Chat with Chloe</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Have a conversation with Chloe. She remembers your past interactions.
        </p>
      </div>
      
      <ChatInterface />
    </div>
  );
} 