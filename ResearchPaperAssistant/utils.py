"""
utils.py - Utility helpers.
Handles dynamic folder creations, file caching, and exporting research summaries/responses
into highly polished, downloadable PDFs using the fpdf2 library.
"""

import os
import logging
from fpdf import FPDF

logger = logging.getLogger(__name__)

def initialize_directories(base_dir: str = "./") -> dict:
    """
    Creates necessary folders for uploads and the vector store database.
    """
    dirs = {
        "upload_dir": os.path.join(base_dir, "uploaded_papers"),
        "chroma_dir": os.path.join(base_dir, "chroma_db")
    }
    
    for name, path in dirs.items():
        if not os.path.exists(path):
            logger.info(f"Creating directory: {path}")
            os.makedirs(path, exist_ok=True)
            
    return dirs

class AcademicPDFExporter(FPDF):
    """
    Custom PDF generation class with formatted academic styling.
    """
    
    def header(self):
        """Standard academic header style."""
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, "Research Paper Assistant - AI Synthesized Academic Report", border=0, ln=1, align="R")
        self.line(10, 17, 200, 17)
        self.ln(5)

    def footer(self):
        """Standard page numbers in footer."""
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        page_no = f"Page {self.page_no()}/{{nb}}"
        self.cell(0, 10, page_no, border=0, align="C")

def export_to_pdf(title: str, text_content: str, filename: str) -> str:
    """
    Generates and saves a beautifully structured PDF document of the research results.
    
    Args:
        title (str): Title of the report (e.g., Summary of Attention Is All You Need).
        text_content (str): The markdown or plain text content.
        filename (str): Output file name.
        
    Returns:
        str: Absolute path of the exported PDF.
    """
    try:
        pdf = AcademicPDFExporter()
        pdf.alias_nb_pages()
        pdf.add_page()
        
        # Set primary body font
        pdf.set_font("Helvetica", size=10)
        pdf.set_auto_page_break(auto=True, margin=15)
        
        # Document Title Card
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(31, 41, 55) # Deep Slate/Charcoal Gray
        pdf.multi_cell(0, 10, title, align="L")
        pdf.ln(5)
        
        # Subheading / Generation info
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(107, 114, 128) # Muted gray
        pdf.cell(0, 5, "Generated automatically by GenAI Research Paper Assistant pipeline.", ln=1)
        pdf.cell(0, 5, "Note: Always cross-reference AI-generated responses with primary papers.", ln=1)
        pdf.ln(10)
        
        # Main Body Text
        pdf.set_font("Helvetica", size=10)
        pdf.set_text_color(55, 65, 81) # Secondary dark gray
        
        # Simple line/paragraph splitting for pdf wrapping
        paragraphs = text_content.split("\n")
        for para in paragraphs:
            para = para.strip()
            if not para:
                pdf.ln(4)
                continue
                
            # Formatting Markdown-like headings inside text
            if para.startswith("### "):
                pdf.set_font("Helvetica", "B", 12)
                pdf.set_text_color(17, 24, 39)
                pdf.multi_cell(0, 8, para.replace("### ", ""))
                pdf.set_font("Helvetica", size=10)
                pdf.set_text_color(55, 65, 81)
            elif para.startswith("## "):
                pdf.set_font("Helvetica", "B", 14)
                pdf.set_text_color(17, 24, 39)
                pdf.multi_cell(0, 8, para.replace("## ", ""))
                pdf.set_font("Helvetica", size=10)
                pdf.set_text_color(55, 65, 81)
            elif para.startswith("# "):
                pdf.set_font("Helvetica", "B", 16)
                pdf.set_text_color(17, 24, 39)
                pdf.multi_cell(0, 10, para.replace("# ", ""))
                pdf.set_font("Helvetica", size=10)
                pdf.set_text_color(55, 65, 81)
            elif para.startswith("- ") or para.startswith("* "):
                # bullet points indentation
                pdf.set_font("Helvetica", size=10)
                pdf.set_text_color(55, 65, 81)
                pdf.multi_cell(0, 6, "  • " + para[2:])
            else:
                pdf.set_font("Helvetica", size=10)
                pdf.set_text_color(55, 65, 81)
                pdf.multi_cell(0, 6, para)
                
        # Save output file
        pdf.output(filename)
        logger.info(f"Successfully generated PDF report: {filename}")
        return filename
        
    except Exception as e:
        logger.error(f"Error compiling PDF exporter: {str(e)}")
        raise e
