print("Minimal memory test")

# Define our own ultra-minimal versions for testing
from langchain.docstore.document import Document

class SimpleVectorStore:
    def __init__(self):
        self.docs = []
    
    def add_documents(self, docs):
        self.docs.extend(docs)
        print(f"Added {len(docs)} documents")
    
    def similarity_search(self, query, k=1, **kwargs):
        print(f"Searching for: {query}")
        if not self.docs:
            return [Document(page_content="No documents available")]
        return self.docs[-k:]  # Just return the most recent k docs

# Create a test instance
vector_store = SimpleVectorStore()

# Add a document
test_doc = Document(page_content="This is a test document", metadata={"source": "test"})
vector_store.add_documents([test_doc])

# Search for something
results = vector_store.similarity_search("test query")
print(f"Found {len(results)} results")
print(f"First result: {results[0].page_content}")

print("Test completed successfully!") 