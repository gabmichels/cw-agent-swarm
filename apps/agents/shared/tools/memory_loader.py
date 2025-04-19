from langchain.vectorstores import Chroma
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.docstore.document import Document
import datetime
import json
from pathlib import Path
import random

embedding_fn = OpenAIEmbeddings()
vectordb = Chroma(persist_directory="./apps/agents/shared/memory/chroma", embedding_function=embedding_fn)

def save_chat_to_memory(text: str, metadata: dict = {"source": "chat"}):
    doc = Document(page_content=text, metadata=metadata)
    vectordb.add_documents([doc])

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
    
    # In a real implementation, we would:
    # 1. Convert the query to an embedding
    # 2. Find messages with similar embeddings
    # 3. Return the most relevant ones
    
    # For this prototype, just return a random response with some length
    substantive_responses = [r for r in agent_responses if len(r) > 50]
    
    if substantive_responses:
        return random.choice(substantive_responses)
    else:
        return random.choice(agent_responses)

def retrieve_high_priority(k=5):
    results = vectordb.similarity_search("important insights", k=k, filter={"importance": "high"})
    return "\n---\n".join([r.page_content for r in results])

def mark_important_insight(text: str, source: str = "unspecified", insight_type: str = "general"):
    """Store an insight marked as high importance with metadata."""
    metadata = {
        "importance": "high",
        "source": source,
        "type": insight_type,
        "timestamp": str(datetime.datetime.now())
    }
    save_chat_to_memory(text, metadata)
    return "✅ Important insight stored!" 