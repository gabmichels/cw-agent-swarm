print("Simple Memory Test")

# Import directly from the implementation
import sys
from apps.agents.shared.tools.memory_loader import (
    save_chat_to_memory, 
    retrieve_similar_chats,
    SimpleMemoryStore
)

# Create a custom test
try:
    # Add a test memory
    print("\nSaving test memory...")
    save_chat_to_memory("This is a test memory entry", {"source": "test_script"})
    print("Memory saved successfully")
    
    # Retrieve something
    print("\nRetrieving memory...")
    result = retrieve_similar_chats("test query")
    print(f"Retrieved: {result[:50]}..." if result else "No result")
    
    print("\nTest completed successfully!")
except Exception as e:
    print(f"Test failed: {str(e)}")
    import traceback
    traceback.print_exc() 