"""
app.py - Main Streamlit User Interface for the Research Paper Assistant.
Provides full visual controls, interactive forms, real-time feedback, and PDF exports.
"""

import os
import streamlit as st
from dotenv import load_dotenv

# Load local environment variables from .env
load_dotenv()

# Verify Gemini API Key exists
if not os.getenv("GEMINI_API_KEY"):
    st.error("⚠️ GEMINI_API_KEY is not defined in the environment or .env file. Please configure your key in Google AI Studio or your secrets panel.")

# Import modules
from pdf_loader import PDFLoader
from text_splitter import AcademicTextSplitter
from vector_store import ChromaVectorStore
from rag_pipeline import ResearchRAGPipeline
from utils import initialize_directories, export_to_pdf

# Set page layout and high-contrast, professional design theme
st.set_page_config(
    page_title="Academic Research Paper Assistant",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom high-contrast academic visual styling
st.markdown("""
<style>
    /* Global styles */
    .main .block-container {
        padding-top: 2rem;
    }
    h1, h2, h3 {
        font-family: 'Space Grotesk', 'Inter', sans-serif !important;
        font-weight: 600;
        letter-spacing: -0.02em;
    }
    /* Tab active styles */
    button[data-baseweb="tab"] {
        font-size: 16px !important;
        font-weight: 500 !important;
    }
    /* Citations custom card styling */
    .citation-box {
        background-color: #f3f4f6;
        border-left: 4px solid #4f46e5;
        padding: 8px 12px;
        margin: 6px 0;
        border-radius: 4px;
        font-size: 13px;
        color: #374151;
    }
    .paper-badge {
        display: inline-block;
        background-color: #e0e7ff;
        color: #4338ca;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        margin-right: 6px;
    }
</style>
""", unsafe_allow_html=True)

# 1. Initialize Folders
dirs = initialize_directories()

# 2. Instantiate persistent Vector Store & RAG Engine
@st.cache_resource
def get_backend_instances():
    vector_store = ChromaVectorStore(persist_directory=dirs["chroma_dir"])
    pipeline = ResearchRAGPipeline(vector_store=vector_store)
    return vector_store, pipeline

try:
    vector_store, pipeline = get_backend_instances()
except Exception as e:
    st.error(f"Failed to load vector embeddings backend: {str(e)}")
    st.stop()

# ----------------- SIDEBAR: DOCUMENT INDEXING & MANAGEMENT -----------------
with st.sidebar:
    st.image("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&q=80", use_container_width=True)
    st.title("📚 Paper Library")
    st.markdown("Upload and index research PDFs to build your local retrieval corpus.")
    
    # PDF Upload Widget (Multiple Files Allowed)
    uploaded_files = st.file_uploader(
        "Upload research PDFs", 
        type=["pdf"], 
        accept_multiple_files=True,
        help="Upload multiple documents to synthesize across themes and papers."
    )
    
    if uploaded_files:
        submit_btn = st.button("🚀 Index Uploaded Papers", use_container_width=True, type="primary")
        
        if submit_btn:
            with st.spinner("Parsing PDFs and generating semantic vector embeddings..."):
                splitter = AcademicTextSplitter(chunk_size=1000, chunk_overlap=200)
                
                total_chunks = 0
                for uploaded_file in uploaded_files:
                    file_name = uploaded_file.name
                    
                    # Prevent duplicate indexing of already indexed papers
                    if file_name in vector_store.get_indexed_papers():
                        st.info(f"ℹ️ '{file_name}' is already indexed in ChromaDB.")
                        continue
                        
                    try:
                        # Load & split
                        file_bytes = uploaded_file.read()
                        pages_data = PDFLoader.extract_text_from_bytes(file_bytes, file_name)
                        
                        if pages_data:
                            chunks = splitter.split_pages(pages_data)
                            success = vector_store.add_documents(chunks)
                            if success:
                                total_chunks += len(chunks)
                                st.success(f"✅ Indexed '{file_name}' ({len(chunks)} chunks)")
                            else:
                                st.error(f"❌ Failed to store '{file_name}' chunks in ChromaDB.")
                        else:
                            st.warning(f"⚠️ Could not extract text from '{file_name}'. Standard scanned PDFs are not supported.")
                    except Exception as e:
                        st.error(f"💥 Error processing '{file_name}': {str(e)}")
                
                if total_chunks > 0:
                    st.toast(f"Successfully processed {total_chunks} academic chunks!", icon="🎉")
                    # Clear st.cache_resource/state if needed
                    st.rerun()

    st.markdown("---")
    
    # List current indexed documents
    indexed_papers = vector_store.get_indexed_papers()
    
    st.subheader(f"Current Library ({len(indexed_papers)})")
    
    if not indexed_papers:
        st.caption("No papers currently indexed. Upload some papers above to start!")
    else:
        for paper in indexed_papers:
            col1, col2 = st.columns([8, 2])
            with col1:
                st.markdown(f"📄 `{paper}`", help=paper)
            with col2:
                # Button to delete a specific indexed paper
                if st.button("🗑️", key=f"del_{paper}", help=f"Remove '{paper}' from database"):
                    vector_store.delete_paper(paper)
                    st.success(f"Deleted '{paper}'")
                    st.rerun()
                    
        # Button to wipe whole corpus
        if st.button("🚨 Wipe Library", use_container_width=True, help="Permanently clear ChromaDB database"):
            vector_store.clear_database()
            pipeline.clear_chat_history()
            st.success("Successfully cleared vector library.")
            st.rerun()

# ----------------- MAIN INTERFACE -----------------
st.title("🎓 GenAI Academic Research Paper Assistant")
st.markdown("Interact semantically with complex literature, extract method layers, and write structured literature reviews.")

if not indexed_papers:
    st.info("💡 **Getting Started:** Upload one or more scientific research papers (PDFs) in the sidebar to initialize your secure RAG library.")
    
    # Simple default educational mockup / introductory text to showcase standard flow
    st.markdown("""
    ### Advanced Features Overview:
    - 💬 **Interactive Chat (RAG)**: Ask cross-document questions and receive responses with exact page numbers.
    - 📝 **Structured Summaries**: Extract Core Hypotheses, Key Contributions, and significance details.
    - 🔬 **Methodology Audits**: Analyze exact algorithms, dataset statistics, formulas, and metric boundaries.
    - ⚔️ **Literature Comparison**: Compare two separate architectures or research formulations side-by-side.
    - 📚 **Literature Reviews**: Synthesize conceptual essays grouping consensus and contention points across multiple documents.
    - 🎓 **MCQ & Quiz Generator**: Generate customized educational test preps and conceptual models.
    """)
    st.stop()

# Build main feature tabs
tab_chat, tab_summarize, tab_method, tab_compare, tab_review, tab_quiz = st.tabs([
    "💬 Interactive Chat (RAG)",
    "📝 Paper Summarization",
    "🔬 Methodology & Findings",
    "⚔️ Paper Comparison",
    "📚 Literature Review",
    "🎓 Quiz Generator"
])

# ----------------- TAB 1: INTERACTIVE CHAT (RAG) -----------------
with tab_chat:
    st.subheader("💬 Citation-Aware Dialogue")
    st.markdown("Ask natural language questions across your entire document database. Responses are grounded in exact retrieved chunks.")
    
    # Allow filtering query within a specific paper or across all papers
    chat_filter = st.selectbox(
        "Focus search inside", 
        ["All Papers"] + indexed_papers,
        key="chat_filter_select"
    )
    
    filter_paper = None if chat_filter == "All Papers" else chat_filter
    
    # Initialize Chat Messages
    if "chat_messages" not in st.session_state:
        st.session_state.chat_messages = []
        
    # Clear chat action
    if st.button("Clear Chat Memory", key="clear_chat_btn"):
        st.session_state.chat_messages = []
        pipeline.clear_chat_history()
        st.rerun()
        
    # Render previous messages in UI
    for message in st.session_state.chat_messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            if "sources" in message and message["sources"]:
                st.markdown("**Retrieved Page Citations:**")
                for src in message["sources"]:
                    st.markdown(f"<div class='citation-box'><span class='paper-badge'>📄 Document</span> <b>{src['source']}</b> (Page {src['page']})</div>", unsafe_allow_html=True)

    # Chat input box
    if prompt := st.chat_input("Ask a research question..."):
        # Display user input
        with st.chat_message("user"):
            st.markdown(prompt)
        st.session_state.chat_messages.append({"role": "user", "content": prompt})
        
        # Generate Answer
        with st.chat_message("assistant"):
            with st.spinner("Consulting local database..."):
                result = pipeline.answer_question(prompt, filter_paper=filter_paper)
                st.markdown(result["answer"])
                
                # Show sources
                if result["sources"]:
                    st.markdown("**Retrieved Page Citations:**")
                    for src in result["sources"]:
                        st.markdown(f"<div class='citation-box'><span class='paper-badge'>📄 Document</span> <b>{src['source']}</b> (Page {src['page']})</div>", unsafe_allow_html=True)
                        
                # Add to chat state
                assistant_message = {
                    "role": "assistant", 
                    "content": result["answer"],
                    "sources": result["sources"]
                }
                st.session_state.chat_messages.append(assistant_message)
                
                # Downloadable option
                export_fn = f"response_{len(st.session_state.chat_messages)}.pdf"
                pdf_path = export_to_pdf(f"Q&A Report: {prompt[:40]}...", result["answer"], export_fn)
                with open(pdf_path, "rb") as f:
                    st.download_button(
                        label="📥 Export Response as Academic PDF",
                        data=f,
                        file_name=export_fn,
                        mime="application/pdf"
                    )

# ----------------- TAB 2: PAPER SUMMARIZATION -----------------
with tab_summarize:
    st.subheader("📝 Structured Paper Summarization")
    st.markdown("Generate high-fidelity, hierarchical executive summaries of specific papers.")
    
    target_paper = st.selectbox("Select paper to summarize", indexed_papers, key="sum_paper_select")
    
    if st.button("⚡ Generate Structured Summary", type="primary", key="sum_btn"):
        with st.spinner(f"Extracting contexts and synthesizing core summary for '{target_paper}'..."):
            summary_output = pipeline.summarize_paper(target_paper)
            
            st.markdown("### Executive Summary Report")
            st.markdown(summary_output)
            
            # Export Report
            filename = f"summary_{target_paper.replace('.pdf', '')}.pdf"
            pdf_path = export_to_pdf(f"Summary Report: {target_paper}", summary_output, filename)
            
            with open(pdf_path, "rb") as f:
                st.download_button(
                    label="📥 Download Summary as Academic PDF",
                    data=f,
                    file_name=filename,
                    mime="application/pdf"
                )

# ----------------- TAB 3: METHODOLOGY & FINDINGS -----------------
with tab_method:
    st.subheader("🔬 Methodology & Results Audit")
    st.markdown("Extract algorithmic workflows, testing parameters, quantitative evaluations, and core limitations.")
    
    target_method_paper = st.selectbox("Select target paper", indexed_papers, key="method_paper_select")
    
    col1, col2 = st.columns(2)
    with col1:
        run_method = st.button("🔍 Analyze Methodology", use_container_width=True)
    with col2:
        run_future = st.button("🚀 Analyze Future Directions", use_container_width=True)
        
    if run_method:
        with st.spinner(f"Extracting design details and metric evaluations for '{target_method_paper}'..."):
            methodology_output = pipeline.extract_methodology(target_method_paper)
            st.markdown("### Methodology & Experimental Audit")
            st.markdown(methodology_output)
            
            filename = f"methodology_{target_method_paper.replace('.pdf', '')}.pdf"
            pdf_path = export_to_pdf(f"Methodology Review: {target_method_paper}", methodology_output, filename)
            with open(pdf_path, "rb") as f:
                st.download_button(
                    label="📥 Download Methodology PDF",
                    data=f,
                    file_name=filename,
                    mime="application/pdf"
                )
                
    if run_future:
        with st.spinner(f"Synthesizing future trajectories and novel recommendations for '{target_method_paper}'..."):
            future_output = pipeline.extract_future_work(target_method_paper)
            st.markdown("### Future Research Directives & Recommendations")
            st.markdown(future_output)
            
            filename = f"future_work_{target_method_paper.replace('.pdf', '')}.pdf"
            pdf_path = export_to_pdf(f"Future Work Trajectories: {target_method_paper}", future_output, filename)
            with open(pdf_path, "rb") as f:
                st.download_button(
                    label="📥 Download Future Directions PDF",
                    data=f,
                    file_name=filename,
                    mime="application/pdf"
                )

# ----------------- TAB 4: PAPER COMPARISON -----------------
with tab_compare:
    st.subheader("⚔️ Comparative Synthesis")
    st.markdown("Perform side-by-side comparative analysis of problem definitions, architectures, performance, and complementarity.")
    
    if len(indexed_papers) < 2:
        st.warning("⚠️ Comparative audits require indexing at least **two** separate papers in your library.")
    else:
        col_pa, col_pb = st.columns(2)
        with col_pa:
            paper_a = st.selectbox("Select Paper A", indexed_papers, key="compare_paper_a")
        with col_pb:
            paper_b = st.selectbox("Select Paper B", indexed_papers, key="compare_paper_b")
            
        if paper_a == paper_b:
            st.error("Error: Please select two distinct research papers to compare.")
        else:
            if st.button("⚡ Perform Comparative Audit", type="primary", key="compare_btn"):
                with st.spinner(f"Synthesizing Comparative Analysis: {paper_a} vs {paper_b}..."):
                    compare_output = pipeline.compare_papers(paper_a, paper_b)
                    
                    st.markdown("### Comparative Evaluation Report")
                    st.markdown(compare_output)
                    
                    filename = f"comparison_{paper_a.replace('.pdf', '')}_vs_{paper_b.replace('.pdf', '')}.pdf"
                    pdf_path = export_to_pdf(f"Comparative Synthesis: {paper_a} vs {paper_b}", compare_output, filename)
                    with open(pdf_path, "rb") as f:
                        st.download_button(
                            label="📥 Download Comparative Report PDF",
                            data=f,
                            file_name=filename,
                            mime="application/pdf"
                        )

# ----------------- TAB 5: LITERATURE REVIEW -----------------
with tab_review:
    st.subheader("📚 Automated Literature Review Synthesis")
    st.markdown("Synthesize multiple scientific sources into a cohesive academic literature review essay on a customized topic.")
    
    # Selection of papers to integrate
    selected_review_papers = st.multiselect(
        "Select source documents to synthesize",
        indexed_papers,
        default=indexed_papers[:min(3, len(indexed_papers))]
    )
    
    topic = st.text_input(
        "Review Topic / Synthesis Query", 
        placeholder="e.g. Advancements in Large Language Model instruction tuning, and dataset challenges",
        value=""
    )
    
    if st.button("✍️ Compile Literature Review", type="primary", key="review_btn"):
        if not selected_review_papers:
            st.error("Error: Please select at least one paper as a citation source.")
        elif not topic.strip():
            st.error("Error: Please specify the focus topic of your literature review.")
        else:
            with st.spinner("Synthesizing citations and compiling comprehensive review..."):
                review_output = pipeline.generate_literature_review(selected_review_papers, topic)
                
                st.markdown(f"### Academic Literature Review: {topic}")
                st.markdown(review_output)
                
                filename = f"literature_review_{topic.lower().replace(' ', '_')[:30]}.pdf"
                pdf_path = export_to_pdf(f"Literature Review: {topic}", review_output, filename)
                with open(pdf_path, "rb") as f:
                    st.download_button(
                        label="📥 Download Literature Review PDF",
                        data=f,
                        file_name=filename,
                        mime="application/pdf"
                    )

# ----------------- TAB 6: QUIZ GENERATOR -----------------
with tab_quiz:
    st.subheader("🎓 Academic Assessment Generator")
    st.markdown("Test your comprehension or generate educational course materials. Automatically builds multiple-choice questions (MCQs) and detailed conceptual prompts.")
    
    quiz_paper = st.selectbox("Select paper source for assessment", indexed_papers, key="quiz_paper_select")
    
    if st.button("📝 Generate Academic Quiz", type="primary", key="quiz_btn"):
        with st.spinner(f"Extracting evaluation data and composing educational test prep for '{quiz_paper}'..."):
            quiz_output = pipeline.generate_quiz(quiz_paper)
            
            st.markdown("### Synthesized Academic Quiz")
            st.markdown(quiz_output)
            
            filename = f"quiz_{quiz_paper.replace('.pdf', '')}.pdf"
            pdf_path = export_to_pdf(f"Comprehension Assessment: {quiz_paper}", quiz_output, filename)
            with open(pdf_path, "rb") as f:
                st.download_button(
                    label="📥 Download Quiz and Answer Key PDF",
                    data=f,
                    file_name=filename,
                    mime="application/pdf"
                )
