from langchain.vectorstores import Chroma
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.docstore.document import Document

embedding_fn = OpenAIEmbeddings()
vectordb = Chroma(persist_directory="./apps/agents/shared/memory/chroma", embedding_function=embedding_fn)

def save_chat_to_memory(text: str, source="chat"):
    doc = Document(page_content=text, metadata={"source": source})
    vectordb.add_documents([doc])

def retrieve_similar_chats(query: str, k=3):
    results = vectordb.similarity_search(query, k=k)
    return "\n---\n".join([r.page_content for r in results]) 