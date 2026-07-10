"""
text_splitter.py - Module for dividing text into chunks using RecursiveCharacterTextSplitter.
Preserves page-level metadata during splitting to ensure precise citation tracking.
"""

import logging
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

class AcademicTextSplitter:
    """
    Splits academic texts into manageable chunks while maintaining 
    proper metadata mappings for page numbers and sources.
    """
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Initializes the text splitter with standard defaults for academic PDFs.
        
        Args:
            chunk_size (int): Character size of each chunk.
            chunk_overlap (int): Overlap size between adjacent chunks.
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # We use RecursiveCharacterTextSplitter as it respects paragraphs and sentences.
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
        logger.info(f"Initialized RecursiveCharacterTextSplitter: chunk_size={chunk_size}, overlap={chunk_overlap}")

    def split_pages(self, pages_data: List[Dict[str, Any]]) -> List[Document]:
        """
        Splits a list of page objects into LangChain Document chunks.
        
        Args:
            pages_data (List[Dict[str, Any]]): List containing 'text' and 'metadata' dicts.
            
        Returns:
            List[Document]: List of LangChain Document objects ready for embedding.
        """
        documents = []
        
        for page in pages_data:
            text = page["text"]
            metadata = page["metadata"]
            
            # Split the text of this specific page
            chunks = self.splitter.split_text(text)
            
            for chunk_index, chunk in enumerate(chunks):
                # We replicate page metadata and add an index for uniqueness
                chunk_metadata = metadata.copy()
                chunk_metadata["chunk_index"] = chunk_index
                
                doc = Document(
                    page_content=chunk,
                    metadata=chunk_metadata
                )
                documents.append(doc)
                
        logger.info(f"Split {len(pages_data)} pages into {len(documents)} document chunks.")
        return documents
