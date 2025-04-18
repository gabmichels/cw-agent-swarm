from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os
import glob
from langchain_core.documents import Document
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_memory_vectorstore():
    # Get the current file's directory and navigate to the memory folder
    current_dir = os.path.dirname(os.path.abspath(__file__))
    memory_dir = os.path.join(current_dir, '../memory')
    
    # Get all markdown files
    md_files = glob.glob(os.path.join(memory_dir, "**/*.md"), recursive=True)
    
    documents = []
    
    # Load each file manually
    for file_path in md_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Create a document with the file content and metadata
            doc = Document(
                page_content=content,
                metadata={"source": file_path}
            )
            documents.append(doc)
    
    # Split the documents
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_documents(documents)
    
    # Create the vector store
    vectordb = Chroma.from_documents(chunks, embedding=OpenAIEmbeddings())
    return vectordb 