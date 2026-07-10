import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up larger JSON payload limits for base64 PDF uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini client server-side securely
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("⚠️ Warning: GEMINI_API_KEY is not defined in the environment. Gemini integrations will fail.");
}

const ai = new GoogleGenAI({
  apiKey: apiKey || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// In-memory paper database for the active user session
interface ResearchPaper {
  id: string;
  name: string;
  size: string;
  base64: string; // Base64 representation of the PDF file
}

const paperDatabase: ResearchPaper[] = [];

// Helper to calculate human-readable file size
function getReadableSize(base64Str: string): string {
  const bytes = Math.round((base64Str.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ================= API ENDPOINTS =================

// 1. Get all indexed papers (without large base64 data)
app.get("/api/papers", (req, res) => {
  try {
    const list = paperDatabase.map((paper) => ({
      id: paper.id,
      name: paper.name,
      size: paper.size,
    }));
    res.json({ success: true, papers: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Upload a new paper
app.post("/api/papers", (req, res) => {
  try {
    const { name, base64 } = req.body;
    if (!name || !base64) {
      return res.status(400).json({ success: false, error: "Missing paper name or base64 data." });
    }

    // Check for duplicates
    const exists = paperDatabase.find((p) => p.name === name);
    if (exists) {
      return res.json({ success: true, message: "Paper already uploaded.", paperId: exists.id });
    }

    const id = "paper_" + Math.random().toString(36).substr(2, 9);
    const size = getReadableSize(base64);

    const newPaper: ResearchPaper = { id, name, size, base64 };
    paperDatabase.push(newPaper);

    console.log(`Indexed new research paper: ${name} (${size})`);
    res.json({ success: true, paperId: id, name, size });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Delete a specific paper
app.delete("/api/papers/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = paperDatabase.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: "Paper not found." });
    }
    const removed = paperDatabase.splice(index, 1);
    console.log(`Deleted research paper: ${removed[0].name}`);
    res.json({ success: true, message: `Successfully deleted ${removed[0].name}.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Wipe all papers
app.post("/api/papers/wipe", (req, res) => {
  try {
    const count = paperDatabase.length;
    paperDatabase.length = 0;
    console.log(`Wiped paper database. Removed ${count} documents.`);
    res.json({ success: true, message: `Successfully wiped ${count} documents.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Interactive Chat (RAG Q&A)
app.post("/api/papers/chat", async (req, res) => {
  try {
    const { paperIds, question, chatHistory } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: "Missing research question." });
    }

    // Resolve target papers
    const targets = paperDatabase.filter((p) => !paperIds || paperIds.length === 0 || paperIds.includes(p.id));
    if (targets.length === 0) {
      return res.json({
        success: true,
        answer: "Please upload and select at least one paper in the sidebar to begin consulting your library.",
        sources: [],
      });
    }

    console.log(`Answering Q&A across ${targets.length} papers: ${question}`);

    // Build the contents payload with the PDF files inline and prompt instructions
    const prompt = `You are an elite academic research assistant. You are helping a researcher analyze scientific literature.
Answer the question based strictly on the text, tables, figures, and methodology described in the attached PDF document(s).

CRITICAL CITATION MANDATE:
- When writing claims, always cite the corresponding paper title and page number (e.g., "[Paper_Title, Page X]").
- Be precise. Use exact page metrics.
- If the answer cannot be found in the provided papers, state: "I cannot find the answer to this question in the selected papers." and do not speculate.

Previous Session Chat History (for conversational context):
${(chatHistory || []).map((msg: any) => `${msg.role === "user" ? "Researcher" : "Assistant"}: ${msg.content}`).join("\n")}

Active Question: ${question}

Scholarly, citation-aware answer:`;

    // Map each target paper into a base64 Gemini part
    const contents: any[] = targets.map((p) => ({
      inlineData: {
        data: p.base64,
        mimeType: "application/pdf",
      },
    }));

    // Add prompt as the final part
    contents.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
    });

    res.json({
      success: true,
      answer: response.text || "No response generated.",
      sources: targets.map((t) => ({ name: t.name, id: t.id })),
    });
  } catch (error: any) {
    console.error("Gemini Chat Q&A Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Paper Summarization
app.post("/api/papers/summarize", async (req, res) => {
  try {
    const { paperId } = req.body;
    const paper = paperDatabase.find((p) => p.id === paperId);
    if (!paper) {
      return res.status(404).json({ success: false, error: "Target paper not found." });
    }

    console.log(`Synthesizing summary for: ${paper.name}`);

    const prompt = `You are an academic reviewer. Analyze the attached PDF paper and compile a high-fidelity structured summary.

Your summary MUST contain the following structured sections:
1. **Executive Summary**: A thorough overview of the paper's core hypothesis, context, and findings (2-3 detailed paragraphs).
2. **Core Research Question**: What exact scientific gap or research question does this paper address?
3. **Key Contributions**: Bulleted details outlining the unique, novel, and concrete contributions of this work.
4. **Experimental/Evaluation Summary**: Summarize what datasets, benchmarks, or environments were tested and the primary quantitative outcomes.
5. **Aesthetic/Scholarly Significance**: Why is this paper highly relevant or groundbreaking for the field?`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: paper.base64,
            mimeType: "application/pdf",
          },
        },
        { text: prompt },
      ],
    });

    res.json({ success: true, result: response.text || "Summary failed to compile." });
  } catch (error: any) {
    console.error("Summarize Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Methodology & Findings Extraction
app.post("/api/papers/methodology", async (req, res) => {
  try {
    const { paperId } = req.body;
    const paper = paperDatabase.find((p) => p.id === paperId);
    if (!paper) {
      return res.status(404).json({ success: false, error: "Target paper not found." });
    }

    console.log(`Extracting methodology for: ${paper.name}`);

    const prompt = `You are a professional scientific review committee member. Analyze the attached research paper and extract:
1. **Theoretical Formulation & Mathematical Framework**: Detail the exact algorithms, model architectures, theoretical proofs, or equations introduced.
2. **Experimental Setup & Datasets**: What metrics (e.g., Accuracy, F1, BLEU, latency) were used? What hardware, datasets (and their sizes), and baseline models were analyzed?
3. **Quantitative Results**: Detail the specific results with exact percentage improvements, tables, or graphs mentioned.
4. **Methodological Limitations & Constraints**: What are the explicitly acknowledged or inferred weaknesses, assumptions, bias layers, or hardware limitations?`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: paper.base64,
            mimeType: "application/pdf",
          },
        },
        { text: prompt },
      ],
    });

    res.json({ success: true, result: response.text || "Methodology failed to extract." });
  } catch (error: any) {
    console.error("Methodology Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Future Directions Analysis
app.post("/api/papers/future-work", async (req, res) => {
  try {
    const { paperId } = req.body;
    const paper = paperDatabase.find((p) => p.id === paperId);
    if (!paper) {
      return res.status(404).json({ success: false, error: "Target paper not found." });
    }

    console.log(`Analyzing future trajectories for: ${paper.name}`);

    const prompt = `Analyze the attached research paper and outline:
1. **Author-Proposed Future Work**: What did the researchers explicitly highlight as open fields or next milestones?
2. **Unresolved Challenges & Open Trajectories**: What gaps still persist despite this paper's findings?
3. **Novel PhD Directives (Your Synthesis)**: Recommend 3 specific, highly challenging research pathways or projects a PhD student should undertake next, inspired directly by this paper.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: paper.base64,
            mimeType: "application/pdf",
          },
        },
        { text: prompt },
      ],
    });

    res.json({ success: true, result: response.text || "Analysis failed to compile." });
  } catch (error: any) {
    console.error("Future Work Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Side-by-Side Paper Comparison
app.post("/api/papers/compare", async (req, res) => {
  try {
    const { paperIdA, paperIdB } = req.body;
    const paperA = paperDatabase.find((p) => p.id === paperIdA);
    const paperB = paperDatabase.find((p) => p.id === paperIdB);

    if (!paperA || !paperB) {
      return res.status(404).json({ success: false, error: "One or both selected papers could not be found." });
    }

    console.log(`Performing comparison: ${paperA.name} vs ${paperB.name}`);

    const prompt = `You are writing a professional academic comparative literature survey. Analyze the two attached research PDFs:

Paper A: "${paperA.name}"
Paper B: "${paperB.name}"

Compare them extensively across the following dimensions:
1. **Problem Formulation**: How does each paper approach and frame the core problem?
2. **Methodology & Architectural Divergences**: Contrast their structures, algorithms, datasets, math bases, or experimental settings.
3. **Quantitative Metric Performance**: Side-by-side compare their numerical results, efficiency profiles, and scaling boundaries.
4. **Key Strengths & Weaknesses**: Analyze the unique advantages and flaws of each.
5. **Complementary Avenues**: How could a researcher merge aspects of both papers to formulate a superior hybrid model or methodology?`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: paperA.base64,
            mimeType: "application/pdf",
          },
        },
        {
          inlineData: {
            data: paperB.base64,
            mimeType: "application/pdf",
          },
        },
        { text: prompt },
      ],
    });

    res.json({ success: true, result: response.text || "Comparison report failed." });
  } catch (error: any) {
    console.error("Comparison Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Automated Literature Review
app.post("/api/papers/review", async (req, res) => {
  try {
    const { paperIds, topic } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, error: "Missing literature review topic focus." });
    }

    const targets = paperDatabase.filter((p) => !paperIds || paperIds.length === 0 || paperIds.includes(p.id));
    if (targets.length === 0) {
      return res.status(400).json({ success: false, error: "No papers selected." });
    }

    console.log(`Compiling literature review for topic: "${topic}" over ${targets.length} papers`);

    const prompt = `You are a scholarly author compiling a cohesive academic literature review.
Write a comprehensive, publication-quality literature review essay synthesizing the attached papers.

Focus Theme of Review: "${topic}"

Your literature review must:
1. Synthesize overlapping themes, ideas, and scientific findings across all papers regarding the theme.
2. Formulate distinct conceptual subsections (with markdown headings) to group common approaches.
3. Highlight consensus and areas of debate or contention in the active literature.
4. Cite the proper paper source within your paragraphs (e.g. "[Paper_Name_Here]") to backup academic assertions.
5. Write with a formal, highly sophisticated academic tone.`;

    const contents: any[] = targets.map((p) => ({
      inlineData: {
        data: p.base64,
        mimeType: "application/pdf",
      },
    }));

    contents.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
    });

    res.json({ success: true, result: response.text || "Literature review failed." });
  } catch (error: any) {
    console.error("Literature Review Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. MCQ & Quiz Generator
app.post("/api/papers/quiz", async (req, res) => {
  try {
    const { paperId } = req.body;
    const paper = paperDatabase.find((p) => p.id === paperId);
    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found." });
    }

    console.log(`Generating quiz for: ${paper.name}`);

    const prompt = `You are an academic professor. Construct a challenging, multi-level comprehension quiz based on the attached PDF.

Provide exactly 5 Multiple Choice Questions (MCQs) and 3 short-answer theoretical conceptual questions.
For every MCQ, write:
- The question text
- Four clear options (A, B, C, D)
- The correct answer key
- A thorough academic explanation of why that option is correct and why other options are incorrect based on details in the paper.

For short-answer questions, provide the questions and an exemplar "model answer" representing excellent academic understanding.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: paper.base64,
            mimeType: "application/pdf",
          },
        },
        { text: prompt },
      ],
    });

    res.json({ success: true, result: response.text || "Quiz failed to generate." });
  } catch (error: any) {
    console.error("Quiz Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= VITE INTEGRATION / SERVER LISTEN =================

async function startServer() {
  // Vite dev middleware for asset serving in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve bundled static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`=================================================`);
    console.log(`🎓 Research Paper Assistant running on Port ${PORT}`);
    console.log(`=================================================`);
  });
}

startServer();
