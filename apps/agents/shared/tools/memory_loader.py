import datetime
import json
import os
from pathlib import Path
import random
from langchain.docstore.document import Document

# Import Chroma in a try block to avoid breaking the entire module
try:
    from langchain_community.vectorstores import Chroma
    from langchain_openai import OpenAIEmbeddings
    CHROMA_AVAILABLE = True
except ImportError:
    print("Warning: Chroma or OpenAI embeddings not available. Using fallback memory system.")
    CHROMA_AVAILABLE = False

# Create a simple in-memory vector store that works without dependencies
class SimpleMemoryStore:
    def __init__(self):
        self.docs = []
        print("Initialized SimpleMemoryStore (fallback)")
        
    def add_documents(self, docs):
        self.docs.extend(docs)
        print(f"Added {len(docs)} documents to SimpleMemoryStore")
        
    def similarity_search(self, query, k=1, **kwargs):
        print(f"Searching SimpleMemoryStore for: {query}")
        if not self.docs:
            return [Document(page_content=f"No results for: {query}")]
        
        # If filter is provided, apply it
        if 'filter' in kwargs and kwargs['filter']:
            filtered = []
            for doc in self.docs:
                matches = True
                for key, value in kwargs['filter'].items():
                    if key not in doc.metadata or doc.metadata[key] != value:
                        matches = False
                        break
                if matches:
                    filtered.append(doc)
            results = filtered[-k:] if filtered else [Document(page_content=f"No filtered results for: {query}")]
        else:
            # Just return the most recent documents
            results = self.docs[-k:]
            
        return results

# Create embeddings with OpenRouter compatibility
def get_embeddings():
    # Check for API keys
    api_key = os.getenv("OPENROUTER_API_KEY", os.getenv("OPENAI_API_KEY"))
    if not api_key:
        raise ValueError("No API key found. Set OPENROUTER_API_KEY or OPENAI_API_KEY in your environment.")
    
    # Use OpenAI embeddings through OpenRouter if needed
    if os.getenv("OPENROUTER_API_KEY"):
        # Create header dictionary for OpenRouter
        headers = {
            "HTTP-Referer": "https://crowd-wisdom.com",
            "X-Title": "Chloe AI CMO"
        }
        
        return OpenAIEmbeddings(
            model="text-embedding-ada-002",
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            model_kwargs={"headers": headers}  # Put headers inside model_kwargs
        )
    else:
        return OpenAIEmbeddings(api_key=api_key)

# Initialize the vectorstore with robust fallback
if CHROMA_AVAILABLE:
    try:
        # Try to initialize with real embeddings and Chroma
        print("Initializing embeddings and Chroma vector store...")
        embedding_fn = get_embeddings()
        vectordb = Chroma(persist_directory="./apps/agents/shared/memory/chroma", embedding_function=embedding_fn)
        print("Chroma vector store initialized successfully!")
    except Exception as e:
        print(f"Warning: Could not initialize Chroma vectorstore: {str(e)}")
        print("Using SimpleMemoryStore as fallback...")
        vectordb = SimpleMemoryStore()
else:
    print("Chroma not available. Using SimpleMemoryStore instead.")
    vectordb = SimpleMemoryStore()

def save_chat_to_memory(text: str, metadata: dict = {"source": "chat"}):
    try:
        doc = Document(page_content=text, metadata=metadata)
        vectordb.add_documents([doc])
    except Exception as e:
        print(f"Error saving to memory: {str(e)}")

def retrieve_similar_chats(query_str, num_results=1):
    """
    Simple function to retrieve similar previous chat exchanges based on a query.
    
    In a real implementation, this would use embeddings to find semantically similar content.
    For this prototype, we'll use a simplified approach of returning random exchanges.
    
    Args:
        query_str (str): The query to search for similar content
        num_results (int): Number of results to return
        
    Returns:
        str: A sample response that would be relevant to the query
    """
    try:
        # First try semantic search if vectordb is working
        try:
            matches = vectordb.similarity_search(query_str, k=num_results)
            if matches:
                return matches[0].page_content
        except Exception as e:
            print(f"Semantic search failed, falling back to file-based search: {str(e)}")
        
        # Define memory paths
        MEMORY_DIR = Path("./apps/hq-ui/history/")
        chat_file = MEMORY_DIR / "chloe_cmo_chat.json"
        
        # Check if chat history exists
        if not chat_file.exists():
            fallback_responses = [
                "I haven't had any discussions about this yet.",
                "I'm still learning about this area.",
                "We haven't covered this topic in our previous conversations.",
                "I'd be happy to discuss this now for the first time."
            ]
            return random.choice(fallback_responses)
        
        # Load chat history
        chat_history = json.loads(chat_file.read_text())
        
        # Filter for agent responses (not user messages)
        agent_responses = [msg["message"] for msg in chat_history if msg["role"] == "agent"]
        
        if not agent_responses:
            return "I haven't had any detailed conversations about this yet."
        
        # For this prototype, just return a random response with some length
        substantive_responses = [r for r in agent_responses if len(r) > 50]
        
        if substantive_responses:
            return random.choice(substantive_responses)
        else:
            return random.choice(agent_responses)
    except Exception as e:
        print(f"Error in retrieve_similar_chats: {str(e)}")
        return "I'm having trouble retrieving my memories right now."

def retrieve_high_priority(k=5):
    try:
        results = vectordb.similarity_search("important insights", k=k, filter={"importance": "high"})
        return "\n---\n".join([r.page_content for r in results])
    except Exception as e:
        print(f"Error retrieving high priority insights: {str(e)}")
        return "No high-priority insights available at the moment."

def mark_important_insight(text: str, source: str = "unspecified", insight_type: str = "general"):
    """Store an insight marked as high importance with metadata."""
    try:
        metadata = {
            "importance": "high",
            "source": source,
            "type": insight_type,
            "timestamp": str(datetime.datetime.now())
        }
        save_chat_to_memory(text, metadata)
        return "✅ Important insight stored!"
    except Exception as e:
        print(f"Error marking important insight: {str(e)}")
        return "⚠️ Unable to store insight due to a technical issue." 