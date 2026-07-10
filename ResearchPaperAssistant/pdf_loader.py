"""
pdf_loader.py - Module for loading PDFs and extracting page-by-page text.
Maintains critical metadata (source filename, page number) for precise citations.
"""

import os
import logging
from typing import List, Dict, Any
from pypdf import PdfReader

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

class PDFLoader:
    """
    Utility class to load PDF documents and extract page-by-page text content
    paired with metadata suitable for vector storage chunking.
    """
    
    @staticmethod
    def load_pdf(file_path: str) -> List[Dict[str, Any]]:
        """
        Loads a PDF file from a local path and extracts text page-by-page.
        
        Args:
            file_path (str): The file path to the PDF.
            
        Returns:
            List[Dict[str, Any]]: A list of dictionaries, where each dict represents a page
                                  containing 'text' and 'metadata' (source and page number).
        """
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            raise FileNotFoundError(f"The PDF file at {file_path} was not found.")
            
        file_name = os.path.basename(file_path)
        logger.info(f"Extracting text from PDF: {file_name}")
        
        pages_data = []
        try:
            reader = PdfReader(file_path)
            total_pages = len(reader.pages)
            logger.info(f"PDF {file_name} loaded successfully. Total pages: {total_pages}")
            
            for page_num, page in enumerate(reader.pages, start=1):
                # Extract text from the page
                text = page.extract_text()
                
                if text and text.strip():
                    pages_data.append({
                        "text": text.strip(),
                        "metadata": {
                            "source": file_name,
                            "page": page_num,
                            "total_pages": total_pages
                        }
                    })
                else:
                    logger.warning(f"Empty or unextractable text on page {page_num} of {file_name}")
                    
        except Exception as e:
            logger.error(f"Error reading PDF {file_name}: {str(e)}")
            raise e
            
        return pages_data

    @staticmethod
    def extract_text_from_bytes(file_bytes: bytes, file_name: str) -> List[Dict[str, Any]]:
        """
        Helper method to extract text directly from bytes (useful in Streamlit uploads).
        """
        import io
        logger.info(f"Extracting text from uploaded PDF bytes: {file_name}")
        
        pages_data = []
        try:
            pdf_file = io.BytesIO(file_bytes)
            reader = PdfReader(pdf_file)
            total_pages = len(reader.pages)
            
            for page_num, page in enumerate(reader.pages, start=1):
                text = page.extract_text()
                if text and text.strip():
                    pages_data.append({
                        "text": text.strip(),
                        "metadata": {
                            "source": file_name,
                            "page": page_num,
                            "total_pages": total_pages
                        }
                    })
        except Exception as e:
            logger.error(f"Error parsing PDF bytes for {file_name}: {str(e)}")
            raise e
            
        return pages_data
