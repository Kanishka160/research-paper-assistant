"""
prompts.py - Structured prompt templates for the Research Paper Assistant.
Handles standard QA, paper summarization, methodology/key findings extraction,
multi-paper comparisons, literature reviews, and quiz generation.
"""

from langchain_core.prompts import PromptTemplate

# RAG Q&A Template
RAG_QA_TEMPLATE = """You are an elite research assistant. You are helping a researcher understand a set of scientific/academic papers.
Answer the user's question based ONLY on the provided context chunks. If the answer cannot be found in the context, say: "I cannot find the answer to this question in the uploaded papers." Do not make up answers.

Always cite the sources (Paper name and Page number) when providing your answer. Format citations clearly in your response.

Context:
{context}

Question: {question}

Answer with detailed, citation-aware explanations:"""

RAG_QA_PROMPT = PromptTemplate(
    template=RAG_QA_TEMPLATE,
    input_variables=["context", "question"]
)

# Paper Summarization Template
SUMMARIZATION_TEMPLATE = """You are an academic researcher. Analyze the following text extracted from a research paper and provide a high-quality, comprehensive summary.

Your summary must contain the following structured sections:
1. **Executive Summary**: A high-level overview of the paper's main contributions (2-3 paragraphs).
2. **Core Research Question**: What exact problem is this paper trying to solve?
3. **Key Contributions**: Bullet points detailing the specific novel contributions of this work.
4. **Significance**: Why is this work important to the field?

Text:
{text}

Structured Summary:"""

SUMMARIZATION_PROMPT = PromptTemplate(
    template=SUMMARIZATION_TEMPLATE,
    input_variables=["text"]
)

# Methodology & Key Findings Template
METHODOLOGY_TEMPLATE = """You are an expert scientific reviewer. Analyze the provided research paper text and extract:
1. **Experimental Design / Methodology**: Detail the exact techniques, frameworks, models, algorithms, dataset sizing, training processes, or mathematical derivations used.
2. **Key Findings**: What were the exact quantitative or qualitative results? State key metrics, percentages, tables or specific trends highlighted.
3. **Limitations**: What are the acknowledged boundaries, biases, or weaknesses of the methodology/conclusions?

Text:
{text}

Methodology & Findings Review:"""

METHODOLOGY_PROMPT = PromptTemplate(
    template=METHODOLOGY_TEMPLATE,
    input_variables=["text"]
)

# Future Work Template
FUTURE_WORK_TEMPLATE = """Analyze the provided research paper text and extract all discussions regarding future directions, unresolved challenges, and prospective investigations.

Structure your analysis as follows:
1. **Directly Proposed Future Work**: What did the authors explicitly list as their next steps or recommendations?
2. **Open Research Questions**: What gaps in the field remain unaddressed according to this paper?
3. **Your Synthesis**: Based on the paper's findings and limitations, what are 2-3 additional novel future research avenues you would recommend to a Ph.D. student?

Text:
{text}

Future Work Report:"""

FUTURE_WORK_PROMPT = PromptTemplate(
    template=FUTURE_WORK_TEMPLATE,
    input_variables=["text"]
)

# Multi-Paper Comparison Template
COMPARISON_TEMPLATE = """You are writing a literature review. Compare and contrast the following research papers based on the provided contexts from both:

Paper A: {paper_a_name}
Context from Paper A:
{paper_a_context}

Paper B: {paper_b_name}
Context from Paper B:
{paper_b_context}

Please compare them across these dimensions:
1. **Problem Formulation**: How does each paper define and approach the problem?
2. **Methodological Differences**: Compare their architectures, datasets, or experimental designs.
3. **Key Divergences in Results**: Do their findings align, or do they contradict each other? What are the relative strengths and weaknesses of each paper?
4. **Complementary Opportunities**: How could these two methodologies be combined to create a superior approach?

Comparative Analysis:"""

COMPARISON_PROMPT = PromptTemplate(
    template=COMPARISON_TEMPLATE,
    input_variables=["paper_a_name", "paper_a_context", "paper_b_name", "paper_b_context"]
)

# Literature Review Template
LITERATURE_REVIEW_TEMPLATE = """You are an expert academic writer compiling a comprehensive literature review from multiple source documents.
Based on the provided contextual chunks from these documents, write a polished, cohesive, and structured Literature Review.

Your literature review must:
1. Synthesize the overlapping themes, methodologies, and findings across all papers.
2. Group related works into distinct conceptual subsections.
3. Highlight consensus and contention in the field.
4. Use standard professional academic phrasing and formal tone.
5. Reference the source papers properly when presenting claims.

Context:
{context}

Synthesis Topic / Focus: {topic}

Polished Academic Literature Review:"""

LITERATURE_REVIEW_PROMPT = PromptTemplate(
    template=LITERATURE_REVIEW_TEMPLATE,
    input_variables=["context", "topic"]
)

# Quiz / MCQ Generation Template
QUIZ_TEMPLATE = """You are an academic educator. Based on the provided research paper context, generate a challenging academic quiz/assessment.

Generate exactly 5 Multiple Choice Questions (MCQs) and 3 short-answer conceptual questions.
For every MCQ, provide:
- The question text
- Four options (A, B, C, D)
- The correct answer
- A detailed explanation of why the answer is correct based on the paper.

For short-answer questions, provide the question and an exemplar "model answer".

Context:
{context}

Educational Quiz:"""

QUIZ_PROMPT = PromptTemplate(
    template=QUIZ_TEMPLATE,
    input_variables=["context"]
)
