from langchain.vectorstores import Chroma
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.docstore.document import Document
import datetime

embedding_fn = OpenAIEmbeddings()
vectordb = Chroma(persist_directory="./apps/agents/shared/memory/chroma", embedding_function=embedding_fn)

def save_chat_to_memory(text: str, metadata: dict = {"source": "chat"}):
    doc = Document(page_content=text, metadata=metadata)
    vectordb.add_documents([doc])

def retrieve_similar_chats(query: str, k=3, filter=None):
    results = vectordb.similarity_search(query, k=k, filter=filter)
    return "\n---\n".join([r.page_content for r in results])

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