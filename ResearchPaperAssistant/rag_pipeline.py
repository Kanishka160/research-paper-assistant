"""
rag_pipeline.py - Central pipeline coordination module.
Integrates LangChain, the Gemini Chat LLM, ChromaDB vector store, and prompts
to provide advanced reasoning, QA, summarization, and comparative analysis.
"""

import os
import logging
from typing import List, Dict, Any, Tuple
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from vector_store import ChromaVectorStore
from prompts import (
    RAG_QA_PROMPT,
    SUMMARIZATION_PROMPT,
    METHODOLOGY_PROMPT,
    FUTURE_WORK_PROMPT,
    COMPARISON_PROMPT,
    LITERATURE_REVIEW_PROMPT,
    QUIZ_PROMPT
)

logger = logging.getLogger(__name__)

class ResearchRAGPipeline:
    """
    Main interface coordinating LLM generations with ChromaDB indexes.
    Implements memory, QA, summarization, comparison, and automated assessment.
    """
    
    def __init__(self, vector_store: ChromaVectorStore):
        """
        Initializes the research assistant RAG pipeline.
        
        Args:
            vector_store (ChromaVectorStore): The instantiated Chroma wrapper.
        """
        self.vector_store = vector_store
        
        # Initialize Gemini API
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not defined in environment variables.")
            
        # We use 'gemini-3.5-flash', which is fast, cost-effective, and supports 
        # complex multi-document structures and long reasoning out-of-the-box.
        logger.info("Initializing ChatGoogleGenerativeAI with model: gemini-3.5-flash")
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-3.5-flash",
            google_api_key=api_key,
            temperature=0.2, # Low temperature for accurate academic extraction
            max_output_tokens=4096
        )
        
        # Simple memory to track active session dialog
        self.chat_history: List[Tuple[str, str]] = []

    def clear_chat_history(self):
        """Resets the conversation history."""
        self.chat_history = []
        logger.info("Chat history cleared.")

    def format_docs_for_context(self, docs: List[Any]) -> str:
        """Helper to format documents into a clean string for the LLM prompt."""
        formatted_chunks = []
        for doc in docs:
            source = doc.metadata.get("source", "Unknown")
            page = doc.metadata.get("page", "Unknown")
            content = doc.page_content
            formatted_chunks.append(f"--- START CHUNK (Source: {source}, Page: {page}) ---\n{content}\n--- END CHUNK ---")
        return "\n\n".join(formatted_chunks)

    def answer_question(self, question: str, filter_paper: Optional[str] = None, k: int = 5) -> Dict[str, Any]:
        """
        Answers a user question based on semantic search results.
        Supports filtering within a single paper or searching all papers.
        
        Args:
            question (str): The academic question.
            filter_paper (str, optional): Target paper's filename to search.
            k (int): Number of chunks to retrieve.
            
        Returns:
            Dict[str, Any]: Contains 'answer' (str) and 'sources' (list of metadata dicts).
        """
        logger.info(f"Answering question: '{question}' (filter_paper={filter_paper})")
        
        # Apply metadata filtering if specified
        filter_dict = {"source": filter_paper} if filter_paper else None
        
        # Retrieve relative chunks
        retrieved_docs = self.vector_store.similarity_search(question, k=k, filter_dict=filter_dict)
        
        if not retrieved_docs:
            return {
                "answer": "No relevant context chunks found in ChromaDB. Please ensure papers are uploaded and indexed.",
                "sources": []
            }
            
        # Build prompt inputs
        context_str = self.format_docs_for_context(retrieved_docs)
        
        # Compile LangChain Runnable
        chain = RAG_QA_PROMPT | self.llm | StrOutputParser()
        
        try:
            # Generate response
            answer = chain.invoke({
                "context": context_str,
                "question": question
            })
            
            # Save history
            self.chat_history.append((question, answer))
            
            # Extract unique sources for UI display
            unique_sources = []
            seen = set()
            for doc in retrieved_docs:
                source = doc.metadata.get("source")
                page = doc.metadata.get("page")
                key = f"{source}_p{page}"
                if key not in seen:
                    seen.add(key)
                    unique_sources.append({
                        "source": source,
                        "page": page
                    })
                    
            return {
                "answer": answer,
                "sources": unique_sources,
                "raw_docs": retrieved_docs
            }
            
        except Exception as e:
            logger.error(f"Error in answer_question pipeline: {str(e)}")
            return {
                "answer": f"Error generating answer: {str(e)}",
                "sources": []
            }

    def summarize_paper(self, paper_name: str) -> str:
        """
        Aggregates chunks from a specific paper and creates a comprehensive summary.
        """
        logger.info(f"Generating summary for: {paper_name}")
        
        # Retrieve all chunks of this paper to synthesize (sorted by page/chunk)
        if not self.vector_store.vector_store:
            return "Vector store is not loaded."
            
        try:
            data = self.vector_store.vector_store.get(where={"source": paper_name})
            documents = data.get("documents", [])
            
            if not documents:
                return f"No document chunks found in ChromaDB for '{paper_name}'."
                
            # Grab representative chunks from different parts of the paper (Intro, Mid, Conclusion)
            # Sorting to ensure logical synthesis
            metadatas = data.get("metadatas", [])
            chunks_with_meta = sorted(
                zip(documents, metadatas), 
                key=lambda x: (x[1].get("page", 0), x[1].get("chunk_index", 0))
            )
            
            # If paper is extremely long, pick representative page samples to fit context
            selected_text_chunks = []
            total_chunks = len(chunks_with_meta)
            
            if total_chunks <= 15:
                selected_text_chunks = [item[0] for item in chunks_with_meta]
            else:
                # Sample introductory chunks, middle chunks, and final chunks
                step = total_chunks // 10
                for i in range(0, total_chunks, step):
                    selected_text_chunks.append(chunks_with_meta[i][0])
                    
            combined_text = "\n\n".join(selected_text_chunks)
            
            # Compile chain
            chain = SUMMARIZATION_PROMPT | self.llm | StrOutputParser()
            summary = chain.invoke({"text": combined_text[:30000]}) # Safety cap around 30k chars
            return summary
            
        except Exception as e:
            logger.error(f"Summary generation error: {str(e)}")
            return f"Failed to generate summary: {str(e)}"

    def extract_methodology(self, paper_name: str) -> str:
        """
        Retrieves methodology/key findings using specialized templates.
        """
        logger.info(f"Extracting methodology for: {paper_name}")
        
        try:
            # Query vector store specifically for method/results related content
            query = "methodology algorithm mathematical derivation experimental setup model architecture evaluation metric dataset sizing quantitative findings"
            filter_dict = {"source": paper_name}
            relevant_docs = self.vector_store.similarity_search(query, k=8, filter_dict=filter_dict)
            
            if not relevant_docs:
                return f"No methodology context found for '{paper_name}' in database."
                
            combined_text = "\n\n".join([doc.page_content for doc in relevant_docs])
            
            chain = METHODOLOGY_PROMPT | self.llm | StrOutputParser()
            review = chain.invoke({"text": combined_text[:25000]})
            return review
            
        except Exception as e:
            logger.error(f"Methodology extraction error: {str(e)}")
            return f"Failed to extract methodology: {str(e)}"

    def extract_future_work(self, paper_name: str) -> str:
        """
        Extracts proposed research direction and unresolved problems.
        """
        logger.info(f"Extracting future work for: {paper_name}")
        
        try:
            query = "future work discussion limitation weakness open problems unresolved gaps recommended investigations next steps"
            filter_dict = {"source": paper_name}
            relevant_docs = self.vector_store.similarity_search(query, k=6, filter_dict=filter_dict)
            
            if not relevant_docs:
                return f"No future work indicators found for '{paper_name}' in database."
                
            combined_text = "\n\n".join([doc.page_content for doc in relevant_docs])
            
            chain = FUTURE_WORK_PROMPT | self.llm | StrOutputParser()
            future_work_report = chain.invoke({"text": combined_text[:25000]})
            return future_work_report
            
        except Exception as e:
            logger.error(f"Future work extraction error: {str(e)}")
            return f"Failed to analyze future work: {str(e)}"

    def compare_papers(self, paper_a_name: str, paper_b_name: str) -> str:
        """
        Performs similarity search across both papers and runs comparative analysis.
        """
        logger.info(f"Comparing: {paper_a_name} vs {paper_b_name}")
        
        try:
            # Multi-angle search for Paper A
            query_a = "contributions framework model evaluation limitations architecture"
            docs_a = self.vector_store.similarity_search(query_a, k=5, filter_dict={"source": paper_a_name})
            context_a = self.format_docs_for_context(docs_a)
            
            # Multi-angle search for Paper B
            docs_b = self.vector_store.similarity_search(query_a, k=5, filter_dict={"source": paper_b_name})
            context_b = self.format_docs_for_context(docs_b)
            
            chain = COMPARISON_PROMPT | self.llm | StrOutputParser()
            comparison = chain.invoke({
                "paper_a_name": paper_a_name,
                "paper_a_context": context_a,
                "paper_b_name": paper_b_name,
                "paper_b_context": context_b
            })
            return comparison
            
        except Exception as e:
            logger.error(f"Comparative analysis error: {str(e)}")
            return f"Failed to generate comparative report: {str(e)}"

    def generate_literature_review(self, papers: List[str], topic: str) -> str:
        """
        Combines semantic findings from multiple papers to write a synthesis report.
        """
        logger.info(f"Generating Literature Review for topic: '{topic}' across papers {papers}")
        
        try:
            all_retrieved_chunks = []
            
            for paper in papers:
                # Retrieve specific segments of each paper relating to the core topic
                docs = self.vector_store.similarity_search(topic, k=3, filter_dict={"source": paper})
                all_retrieved_chunks.extend(docs)
                
            if not all_retrieved_chunks:
                return "No matching content found across these papers for the designated topic."
                
            context_str = self.format_docs_for_context(all_retrieved_chunks)
            
            chain = LITERATURE_REVIEW_PROMPT | self.llm | StrOutputParser()
            literature_review = chain.invoke({
                "context": context_str,
                "topic": topic
            })
            return literature_review
            
        except Exception as e:
            logger.error(f"Literature review generation error: {str(e)}")
            return f"Failed to generate literature review: {str(e)}"

    def generate_quiz(self, paper_name: str) -> str:
        """
        Generates challenging MCQs and conceptual questions from a paper.
        """
        logger.info(f"Generating academic quiz for: {paper_name}")
        
        try:
            # Pull representative chunks
            relevant_docs = self.vector_store.similarity_search(
                "key results evaluation framework formulas contributions experiments dataset results findings", 
                k=8, 
                filter_dict={"source": paper_name}
            )
            
            if not relevant_docs:
                return f"No document chunks available to generate a quiz for '{paper_name}'."
                
            context_str = self.format_docs_for_context(relevant_docs)
            
            chain = QUIZ_PROMPT | self.llm | StrOutputParser()
            quiz = chain.invoke({"context": context_str})
            return quiz
            
        except Exception as e:
            logger.error(f"Quiz generation error: {str(e)}")
            return f"Failed to construct quiz: {str(e)}"
