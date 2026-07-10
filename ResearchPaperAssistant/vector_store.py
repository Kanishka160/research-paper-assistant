"""
vector_store.py - Module for ChromaDB vector database operations.
Handles indexing document chunks, persistence, and similarity search queries.
"""

import os
import logging
from typing import List, Optional
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from embeddings import get_gemini_embeddings

logger = logging.getLogger(__name__)

class ChromaVectorStore:
    """
    Wrapper for ChromaDB operations to persist academic paper chunks
    and search them semantically.
    """
    
    def __init__(self, persist_directory: str = "./chroma_db"):
        """
        Initializes the Chroma vector store.
        
        Args:
            persist_directory (str): Path to persist Chroma database files.
        """
        self.persist_directory = persist_directory
        self.embeddings = get_gemini_embeddings()
        self.vector_store: Optional[Chroma] = None
        
        # Initialize or load existing database
        self.load_or_create_store()

    def load_or_create_store(self) -> Chroma:
        """
        Loads the persistent Chroma DB if it exists, otherwise creates a new empty one.
        """
        try:
            logger.info(f"Loading ChromaDB from persistent directory: {self.persist_directory}")
            self.vector_store = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings
            )
            return self.vector_store
        except Exception as e:
            logger.error(f"Failed to load/create ChromaDB: {str(e)}")
            raise e

    def add_documents(self, documents: List[Document]) -> bool:
        """
        Adds document chunks to the vector database and persists them.
        
        Args:
            documents (List[Document]): Chunks to be added.
            
        Returns:
            bool: True if successful, False otherwise.
        """
        if not self.vector_store:
            self.load_or_create_store()
            
        if not documents:
            logger.warning("No documents provided to add to ChromaDB.")
            return False
            
        logger.info(f"Adding {len(documents)} document chunks to ChromaDB...")
        try:
            self.vector_store.add_documents(documents)
            logger.info("Successfully added documents and persisted ChromaDB.")
            return True
        except Exception as e:
            logger.error(f"Error adding documents to ChromaDB: {str(e)}")
            return False

    def similarity_search(self, query: str, k: int = 4, filter_dict: Optional[dict] = None) -> List[Document]:
        """
        Performs semantic search to find top k matching document chunks.
        
        Args:
            query (str): The search query.
            k (int): Number of chunks to retrieve.
            filter_dict (dict, optional): Meta-data filtering (e.g., search within a specific paper).
            
        Returns:
            List[Document]: List of relevant documents.
        """
        if not self.vector_store:
            self.load_or_create_store()
            
        logger.info(f"Executing similarity search for query: '{query}' (k={k}, filter={filter_dict})")
        try:
            results = self.vector_store.similarity_search(query, k=k, filter=filter_dict)
            logger.info(f"Found {len(results)} matches in ChromaDB.")
            return results
        except Exception as e:
            logger.error(f"Error during similarity search: {str(e)}")
            return []

    def get_indexed_papers(self) -> List[str]:
        """
        Retrieves a list of unique paper names already indexed in the vector store.
        """
        if not self.vector_store:
            return []
            
        try:
            # Chroma allows us to access metadatas
            data = self.vector_store.get()
            if not data or 'metadatas' not in data or not data['metadatas']:
                return []
                
            unique_papers = set()
            for meta in data['metadatas']:
                if meta and 'source' in meta:
                    unique_papers.add(meta['source'])
                    
            return sorted(list(unique_papers))
        except Exception as e:
            logger.error(f"Error getting indexed papers: {str(e)}")
            return []

    def delete_paper(self, paper_name: str) -> bool:
        """
        Deletes chunks corresponding to a specific paper from ChromaDB.
        """
        if not self.vector_store:
            return False
            
        try:
            logger.info(f"Deleting paper chunks from ChromaDB for source: {paper_name}")
            # Retrieve IDs of matching chunks
            data = self.vector_store.get(where={"source": paper_name})
            ids = data.get("ids", [])
            
            if ids:
                self.vector_store.delete(ids=ids)
                logger.info(f"Successfully deleted {len(ids)} chunks for paper '{paper_name}'.")
                return True
            else:
                logger.warning(f"No indexed chunks found for paper '{paper_name}'.")
                return False
        except Exception as e:
            logger.error(f"Error deleting paper '{paper_name}': {str(e)}")
            return False

    def clear_database(self) -> bool:
        """
        Clears all documents in the current vector database.
        """
        if not self.vector_store:
            return False
            
        try:
            logger.info("Clearing entire ChromaDB database...")
            data = self.vector_store.get()
            ids = data.get("ids", [])
            if ids:
                self.vector_store.delete(ids=ids)
            logger.info("ChromaDB cleared successfully.")
            return True
        except Exception as e:
            logger.error(f"Failed to clear ChromaDB: {str(e)}")
            return False
