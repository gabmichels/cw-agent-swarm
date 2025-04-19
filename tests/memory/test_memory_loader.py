import os
import traceback
from apps.agents.shared.tools.memory_loader import get_embeddings, retrieve_similar_chats

print("Testing memory loader...")
try:
    # Try to initialize embeddings
    print("Initializing embeddings...")
    embeddings = get_embeddings()
    print("✅ Embeddings initialized successfully!")
    
    # Test retrieve_similar_chats
    print("Testing retrieve_similar_chats...")
    result = retrieve_similar_chats("test query")
    print(f"✅ Retrieved chat: {result[:50]}...")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    print("Traceback:")
    traceback.print_exc() 