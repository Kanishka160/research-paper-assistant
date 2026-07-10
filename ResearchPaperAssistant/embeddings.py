"""
embeddings.py - Module for initializing Gemini Embeddings.
Uses the langchain-google-genai package to call Google's state-of-the-art embedding models.
"""

import os
import logging
from langchain_google_genai import GoogleGenerativeAIEmbeddings

logger = logging.getLogger(__name__)

def get_gemini_embeddings() -> GoogleGenerativeAIEmbeddings:
    """
    Initializes and returns the GoogleGenerativeAIEmbeddings instance
    using the GEMINI_API_KEY from environment variables.
    
    Returns:
        GoogleGenerativeAIEmbeddings: The configured embedding model.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable is not set!")
        raise ValueError(
            "GEMINI_API_KEY is missing from environment. "
            "Please configure it in your .env file or your environment variables."
        )
        
    logger.info("Initializing Google Generative AI Embeddings using models/text-embedding-004")
    
    try:
        # We use 'models/text-embedding-004', which is the standard high-performance embedding model
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=api_key
        )
        return embeddings
    except Exception as e:
        logger.error(f"Error initializing Google Generative AI Embeddings: {str(e)}")
        raise e
