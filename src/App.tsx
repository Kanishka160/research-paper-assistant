import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  Upload, 
  Trash2, 
  MessageSquare, 
  Layers, 
  Compass, 
  FileText, 
  GitCompare, 
  BookMarked, 
  Award, 
  CheckCircle2, 
  Download, 
  Printer, 
  Loader2, 
  HelpCircle,
  FileDown,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Interfaces
interface Paper {
  id: string;
  name: string;
  size: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { name: string; id: string }[];
}

export default function App() {
  // Papers State
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<"chat" | "summarize" | "methodology" | "compare" | "review" | "quiz">("chat");

  // Loaders
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Chat Tab State
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Welcome to your Academic Research Assistant. Select papers in the library sidebar and ask any scholarly or technical questions. I will consult their full contents to provide citation-aware answers.",
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Summarize Tab State
  const [summarizePaperId, setSummarizePaperId] = useState("");
  const [summarizeResult, setSummarizeResult] = useState<string | null>(null);

  // Methodology Tab State
  const [methodologyPaperId, setMethodologyPaperId] = useState("");
  const [methodologyResult, setMethodologyResult] = useState<string | null>(null);
  const [methodologyMode, setMethodologyMode] = useState<"method" | "future">("method");

  // Comparison Tab State
  const [comparePaperIdA, setComparePaperIdA] = useState("");
  const [comparePaperIdB, setComparePaperIdB] = useState("");
  const [compareResult, setCompareResult] = useState<string | null>(null);

  // Literature Review Tab State
  const [reviewPaperIds, setReviewPaperIds] = useState<string[]>([]);
  const [reviewTopic, setReviewTopic] = useState("");
  const [reviewResult, setReviewResult] = useState<string | null>(null);

  // Quiz Tab State
  const [quizPaperId, setQuizPaperId] = useState("");
  const [quizResult, setQuizResult] = useState<string | null>(null);

  // On Mount: Load Indexed Papers
  useEffect(() => {
    fetchPapers();
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const fetchPapers = async () => {
    try {
      const res = await fetch("/api/papers");
      const data = await res.json();
      if (data.success) {
        setPapers(data.papers);
        // Pre-select first paper for summarize/quiz/etc if none selected
        if (data.papers.length > 0) {
          if (!summarizePaperId) setSummarizePaperId(data.papers[0].id);
          if (!methodologyPaperId) setMethodologyPaperId(data.papers[0].id);
          if (!comparePaperIdA) setComparePaperIdA(data.papers[0].id);
          if (data.papers.length > 1 && !comparePaperIdB) setComparePaperIdB(data.papers[1].id);
          if (!quizPaperId) setQuizPaperId(data.papers[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load papers:", err);
    }
  };

  // File Upload Handler via FileReader
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    const loaderMessages = [
      "Parsing document structure...",
      "Extracting tables and metadata...",
      "Indexing citations into database..."
    ];
    let msgIdx = 0;
    const interval = setInterval(() => {
      setLoadingMessage(loaderMessages[msgIdx % loaderMessages.length]);
      msgIdx++;
    }, 1500);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== "application/pdf") {
          setUploadError(`File '${file.name}' is not a PDF. Only PDF papers are supported.`);
          continue;
        }

        const base64 = await convertFileToBase64(file);
        
        const response = await fetch("/api/papers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, base64 }),
        });

        const result = await response.json();
        if (!result.success) {
          setUploadError(`Failed to upload ${file.name}: ${result.error}`);
        }
      }
      await fetchPapers();
    } catch (err: any) {
      setUploadError(`Error processing files: ${err.message}`);
    } finally {
      clearInterval(interval);
      setIsUploading(false);
      setLoadingMessage("");
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // strip data:application/pdf;base64, prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const deletePaper = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/papers/${id}`, { method: "DELETE" });
      setPapers(papers.filter(p => p.id !== id));
      setSelectedPaperIds(selectedPaperIds.filter(pid => pid !== id));
    } catch (err) {
      console.error("Failed to delete paper:", err);
    }
  };

  const wipeCorpus = async () => {
    if (!confirm("Are you sure you want to permanently clear your research paper library?")) return;
    try {
      await fetch("/api/papers/wipe", { method: "POST" });
      setPapers([]);
      setSelectedPaperIds([]);
      setChatMessages([
        {
          role: "assistant",
          content: "Library cleared. Upload new research PDFs to begin.",
        }
      ]);
    } catch (err) {
      console.error("Wipe failed:", err);
    }
  };

  const togglePaperSelection = (id: string) => {
    if (selectedPaperIds.includes(id)) {
      setSelectedPaperIds(selectedPaperIds.filter(pid => pid !== id));
    } else {
      setSelectedPaperIds([...selectedPaperIds, id]);
    }
  };

  // Chat Q&A Submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;

    const query = chatInput.trim();
    setChatInput("");

    const newMessages: Message[] = [...chatMessages, { role: "user", content: query }];
    setChatMessages(newMessages);

    setIsLoading(true);
    setLoadingMessage("Synthesizing citations from your indexed papers...");

    try {
      const res = await fetch("/api/papers/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperIds: selectedPaperIds,
          question: query,
          chatHistory: newMessages.slice(-5) // limit context history to last 5
        })
      });

      const data = await res.json();
      if (data.success) {
        setChatMessages([...newMessages, { role: "assistant", content: data.answer, sources: data.sources }]);
      } else {
        setChatMessages([...newMessages, { role: "assistant", content: `Error: ${data.error}` }]);
      }
    } catch (err: any) {
      setChatMessages([...newMessages, { role: "assistant", content: `Failed to connect to backend: ${err.message}` }]);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Summarize Action
  const triggerSummarize = async () => {
    if (!summarizePaperId) return;
    setIsLoading(true);
    setLoadingMessage("Reading pages and framing executive sections...");
    setSummarizeResult(null);

    try {
      const res = await fetch("/api/papers/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: summarizePaperId }),
      });
      const data = await res.json();
      if (data.success) {
        setSummarizeResult(data.result);
      } else {
        setSummarizeResult(`Synthesis Error: ${data.error}`);
      }
    } catch (err: any) {
      setSummarizeResult(`Failed to generate summary: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Methodology & Findings / Future Work
  const triggerMethodology = async (mode: "method" | "future") => {
    if (!methodologyPaperId) return;
    setMethodologyMode(mode);
    setIsLoading(true);
    setLoadingMessage(mode === "method" ? "Analyzing algorithmic layers and statistical tables..." : "Synthesizing PhD trajectory directives...");
    setMethodologyResult(null);

    const url = mode === "method" ? "/api/papers/methodology" : "/api/papers/future-work";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: methodologyPaperId }),
      });
      const data = await res.json();
      if (data.success) {
        setMethodologyResult(data.result);
      } else {
        setMethodologyResult(`Extraction Error: ${data.error}`);
      }
    } catch (err: any) {
      setMethodologyResult(`Extraction failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Comparison
  const triggerComparison = async () => {
    if (!comparePaperIdA || !comparePaperIdB) return;
    if (comparePaperIdA === comparePaperIdB) {
      alert("Please select two distinct papers to compare side-by-side.");
      return;
    }
    setIsLoading(true);
    setLoadingMessage("Parsing joint context nodes and mapping architecture offsets...");
    setCompareResult(null);

    try {
      const res = await fetch("/api/papers/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperIdA: comparePaperIdA, paperIdB: comparePaperIdB }),
      });
      const data = await res.json();
      if (data.success) {
        setCompareResult(data.result);
      } else {
        setCompareResult(`Comparison Error: ${data.error}`);
      }
    } catch (err: any) {
      setCompareResult(`Comparison failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Literature Review
  const triggerReview = async () => {
    if (reviewPaperIds.length === 0) {
      alert("Please select at least one paper as a citation focus.");
      return;
    }
    if (!reviewTopic.trim()) {
      alert("Please enter a custom review theme or focus question.");
      return;
    }
    setIsLoading(true);
    setLoadingMessage("Synthesizing multi-source contexts into professional prose...");
    setReviewResult(null);

    try {
      const res = await fetch("/api/papers/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperIds: reviewPaperIds, topic: reviewTopic }),
      });
      const data = await res.json();
      if (data.success) {
        setReviewResult(data.result);
      } else {
        setReviewResult(`Literature synthesis failed: ${data.error}`);
      }
    } catch (err: any) {
      setReviewResult(`Failed to generate review: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Quiz Generator
  const triggerQuiz = async () => {
    if (!quizPaperId) return;
    setIsLoading(true);
    setLoadingMessage("Compiling comprehension models and explanation rubrics...");
    setQuizResult(null);

    try {
      const res = await fetch("/api/papers/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: quizPaperId }),
      });
      const data = await res.json();
      if (data.success) {
        setQuizResult(data.result);
      } else {
        setQuizResult(`Quiz failed to generate: ${data.error}`);
      }
    } catch (err: any) {
      setQuizResult(`Error generating quiz: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Utility to export outputs to downloadable txt/md file
  const downloadReport = (title: string, text: string) => {
    const element = document.createElement("a");
    const file = new Blob([`# ${title}\n\n${text}`], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_report.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Simplified Markdown parser to render titles and bold bullets elegantly
  const formatMarkdown = (text: string) => {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      line = line.trim();
      if (!line) return <div key={i} className="h-2" />;
      
      if (line.startsWith("### ")) {
        return <h4 key={i} className="text-base font-semibold text-slate-800 mt-3 mb-1 font-display">{line.replace("### ", "")}</h4>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={i} className="text-lg font-bold text-indigo-900 mt-4 mb-2 font-display border-b border-indigo-100 pb-1">{line.replace("## ", "")}</h3>;
      }
      if (line.startsWith("# ")) {
        return <h2 key={i} className="text-2xl font-bold text-slate-900 mt-5 mb-3 font-display">{line.replace("# ", "")}</h2>;
      }
      if (line.startsWith("> ")) {
        return (
          <p key={i} className="mb-3 italic border-l-4 border-indigo-200 pl-4 bg-slate-50 py-2 text-slate-600 text-sm">
            {parseInlineStyles(line.replace("> ", ""))}
          </p>
        );
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const content = line.substring(2);
        return (
          <li key={i} className="ml-4 list-disc text-slate-600 mb-1 leading-relaxed text-sm">
            {parseInlineStyles(content)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        const content = line.replace(/^\d+\.\s/, "");
        return (
          <li key={i} className="ml-4 list-decimal text-slate-600 mb-1 leading-relaxed text-sm">
            {parseInlineStyles(content)}
          </li>
        );
      }
      return <p key={i} className="text-slate-600 leading-relaxed text-sm mb-3">{parseInlineStyles(line)}</p>;
    });
  };

  // Simple parser to make **bold** inline text work elegantly
  const parseInlineStyles = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden" id="app_root">
      
      {/* ================= LIBRARY SIDEBAR ================= */}
      <div className="w-72 bg-slate-50 text-slate-800 flex flex-col border-r border-slate-200 shrink-0" id="sidebar_container">
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 flex items-center space-x-3 bg-white">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sm tracking-tight text-slate-800">Research Library</h1>
            <span className="text-[10px] text-slate-400 font-mono">Secured Gemini RAG</span>
          </div>
        </div>

        {/* Upload Area */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <label className="group flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:bg-slate-50">
            <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition" />
            <span className="text-xs font-semibold mt-2 text-slate-700 group-hover:text-indigo-600">Upload Research PDFs</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Drag & drop or click</span>
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf" 
              multiple 
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
          
          {isUploading && (
            <div className="mt-3 flex items-center space-x-3 text-indigo-700 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-600" />
              <div className="text-xs">
                <span className="font-semibold block text-indigo-800 text-[11px]">Indexing Corpus...</span>
                <span className="text-indigo-600 font-mono text-[9px]">{loadingMessage || "Reading bytes..."}</span>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="mt-2 text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              {uploadError}
            </div>
          )}
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold font-mono uppercase text-slate-400 tracking-wider mb-2 px-1">
            <span>Indexed Library ({papers.length})</span>
            {papers.length > 0 && (
              <button 
                onClick={wipeCorpus}
                className="text-slate-400 hover:text-rose-600 transition flex items-center space-x-1 font-sans font-normal normal-case text-[10px]"
              >
                <Trash2 className="w-3 h-3" />
                <span>Wipe All</span>
              </button>
            )}
          </div>

          {papers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
              <p>Your library is empty.</p>
              <p className="text-[10px] text-slate-400 mt-1">Upload research PDFs to start analyzing them.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {papers.map((paper) => {
                const isSelected = selectedPaperIds.includes(paper.id);
                return (
                  <div
                    key={paper.id}
                    onClick={() => togglePaperSelection(paper.id)}
                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all duration-150 ${
                      isSelected 
                        ? "bg-white border-indigo-400 ring-1 ring-indigo-400 text-slate-900 shadow-sm" 
                        : "bg-white border-slate-200 hover:bg-slate-100/50 text-slate-700 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {/* Red PDF miniature mockup badge */}
                      <div className={`h-8 w-6 shrink-0 flex items-center justify-center text-[8px] font-bold border rounded ${
                        isSelected 
                          ? "bg-indigo-50 text-indigo-600 border-indigo-200" 
                          : "bg-red-50 text-red-600 border-red-200"
                      }`}>PDF</div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate text-slate-800 leading-tight">{paper.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{paper.size}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => deletePaper(paper.id, e)}
                      className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 p-1 rounded transition duration-150 shrink-0"
                      title="Delete paper"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Instructions / Status indicator -> Styled exactly like the Vector Store Info box */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="rounded-lg bg-indigo-50 p-3">
            <p className="text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Vector Store Info
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-indigo-600/80">
              {papers.length} paper{papers.length !== 1 ? 's' : ''} indexed. Using RecursiveCharacterSplitter chunks. Ready for semantic lookup.
            </p>
          </div>
        </div>
      </div>

      {/* ================= MAIN ASSISTANT FRAME ================= */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50" id="main_frame_content">
        
        {/* Main Dashboard Navigation Bar */}
        <header className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-600 text-white shadow-sm">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">ResearchPaper<span className="text-indigo-600">Assistant</span></h1>
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">v1.2.0</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Pulsing Gemini Connected indicator */}
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 shrink-0">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-semibold text-slate-600">Gemini Active</span>
            </div>

            {/* Active selection helper */}
            <div className="text-xs font-mono bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 hidden sm:block shrink-0">
              Query Focus: <span className="font-bold text-indigo-600">{selectedPaperIds.length === 0 ? "All Papers" : `${selectedPaperIds.length} Selected`}</span>
            </div>
          </div>
        </header>

        {/* Feature Tab Selection Row */}
        <div className="bg-slate-50/50 border-b border-slate-200 px-6 py-2.5 flex space-x-1 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "chat" 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Interactive Chat (RAG)</span>
          </button>

          <button
            onClick={() => setActiveTab("summarize")}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "summarize" 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Structured Summary</span>
          </button>

          <button
            onClick={() => setActiveTab("methodology")}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "methodology" 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Methodology & Findings</span>
          </button>

          <button
            onClick={() => setActiveTab("compare")}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "compare" 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Side-by-Side Compare</span>
          </button>

          <button
            onClick={() => setActiveTab("review")}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "review" 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Literature Review</span>
          </button>

          <button
            onClick={() => setActiveTab("quiz")}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "quiz" 
                ? "bg-indigo-600 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Quiz Generator</span>
          </button>
        </div>

        {/* Global Pending Loader Backdrop */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm flex flex-col items-center border border-slate-200">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
              <p className="text-sm font-semibold text-slate-900">Academic Synthesis Active</p>
              <p className="text-xs text-slate-500 font-mono text-center mt-1.5">{loadingMessage || "Please wait while Gemini processes the papers..."}</p>
            </div>
          </div>
        )}

        {/* ================= DYNAMIC WORKSPACE ================= */}
        <div className="flex-1 overflow-y-auto p-6" id="workspace_content">
          <AnimatePresence mode="wait">
            
            {/* 1. INTERACTIVE CHAT TAB */}
            {activeTab === "chat" && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full space-y-4 justify-between"
              >
                {/* Chat History Messages Stream */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                  {chatMessages.map((msg, idx) => {
                    if (msg.role === "user") {
                      return (
                        <div 
                          key={idx} 
                          className="flex items-start gap-3 justify-end"
                        >
                          <div className="flex flex-col items-end max-w-3xl">
                            <div className="rounded-2xl rounded-tr-none bg-indigo-600 border border-indigo-700 px-4 py-3 text-sm text-white shadow-sm">
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            </div>
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 shadow-sm font-mono">
                            U
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div 
                          key={idx} 
                          className="flex items-start gap-3 justify-start"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <div className="flex-1 max-w-3xl">
                            {idx > 0 && (
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                ASSISTANT • Gemini 1.5
                              </div>
                            )}
                            <div className="rounded-2xl rounded-tl-none bg-white border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm">
                              <div className="prose prose-slate prose-sm text-inherit max-w-none">
                                {formatMarkdown(msg.content)}
                              </div>

                              {/* Rendering Citation Page Badges as elegant blue capsules */}
                              {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold mr-1">Sources consulted:</span>
                                  {msg.sources.map((src, sIdx) => (
                                    <span 
                                      key={sIdx}
                                      className="inline-flex items-center gap-1.5 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 font-mono"
                                    >
                                      {src.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Export response option */}
                              {idx > 0 && (
                                <div className="mt-3 pt-2 border-t border-slate-50 flex justify-end">
                                  <button
                                    onClick={() => downloadReport(`Response_QA_${idx}`, msg.content)}
                                    className="inline-flex items-center space-x-1 text-slate-400 hover:text-indigo-600 transition text-xs font-mono"
                                  >
                                    <FileDown className="w-3.5 h-3.5" />
                                    <span>Export Report</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Form Input Box */}
                <div className="border-t border-slate-200 pt-4 bg-slate-50/50 -mx-6 -mb-6 p-6 shrink-0">
                  <form onSubmit={handleChatSubmit} className="relative flex items-center">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={papers.length === 0 ? "Please upload research papers to start asking questions..." : "Ask about methodology, findings, or specific equations..."}
                      disabled={papers.length === 0}
                      className="w-full rounded-xl border border-slate-300 bg-white py-4 pl-4 pr-32 shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-slate-800"
                    />
                    <div className="absolute right-2 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || papers.length === 0}
                        className="flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-40"
                      >
                        <span>Send</span>
                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 5l7 7-7 7M5 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                      </button>
                    </div>
                  </form>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <p>Multi-paper Mode: <span className="font-bold text-indigo-600">{selectedPaperIds.length > 1 ? "ON" : "OFF"}</span> • History Length: <span className="font-bold text-indigo-600">5 turns</span></p>
                    <div className="flex items-center gap-3">
                      <span>Press <kbd className="rounded bg-slate-200 px-1 border border-slate-300">Enter</kbd> to ask</span>
                      <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div> DB Status: Ready</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. STRUCTURED SUMMARY TAB */}
            {activeTab === "summarize" && (
              <motion.div
                key="summarize"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-base font-bold font-display text-slate-900 mb-2">Hierarchical Executive Summarizer</h3>
                  <p className="text-xs text-slate-500 mb-4">Select an indexed document to compile structured highlights detailing core hypotheses, key claims, methodology highlights, and research values.</p>

                  <div className="flex items-center space-x-3">
                    <select
                      value={summarizePaperId}
                      onChange={(e) => setSummarizePaperId(e.target.value)}
                      className="bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 w-72 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose a Paper --</option>
                      {papers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    <button
                      onClick={triggerSummarize}
                      disabled={!summarizePaperId || isLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Synthesize Summary</span>
                    </button>
                  </div>
                </div>

                {summarizeResult && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-slate-500 font-semibold">Synthesis Report</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => downloadReport("Summary_Report", summarizeResult)}
                          className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
                          title="Export Report"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
                          title="Print Document"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 max-w-4xl mx-auto prose prose-slate">
                      {formatMarkdown(summarizeResult)}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 3. METHODOLOGY & FINDINGS TAB */}
            {activeTab === "methodology" && (
              <motion.div
                key="methodology"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-base font-bold font-display text-slate-900 mb-2">Scientific & Methodological Reviewer</h3>
                  <p className="text-xs text-slate-500 mb-4">Audit mathematical formulations, training processes, datasets, benchmarks, limitations, and future PhD trajectory opportunities.</p>

                  <div className="flex items-center space-x-3">
                    <select
                      value={methodologyPaperId}
                      onChange={(e) => setMethodologyPaperId(e.target.value)}
                      className="bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 w-72 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose a Paper --</option>
                      {papers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    <button
                      onClick={() => triggerMethodology("method")}
                      disabled={!methodologyPaperId || isLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      Audit Methodology
                    </button>

                    <button
                      onClick={() => triggerMethodology("future")}
                      disabled={!methodologyPaperId || isLoading}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2 rounded-lg border border-slate-200 transition disabled:opacity-50"
                    >
                      PhD Directives
                    </button>
                  </div>
                </div>

                {methodologyResult && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
                        {methodologyMode === "method" ? "Theoretical Architecture Report" : "Future Trajectory Report"}
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => downloadReport(methodologyMode === "method" ? "Methodology_Audit" : "Future_Trajectories", methodologyResult)}
                          className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
                          title="Export Report"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 max-w-4xl mx-auto prose prose-slate">
                      {formatMarkdown(methodologyResult)}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 4. SIDE-BY-SIDE COMPARE TAB */}
            {activeTab === "compare" && (
              <motion.div
                key="compare"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-base font-bold font-display text-slate-900 mb-2">Cross-Document Architecture Evaluator</h3>
                  <p className="text-xs text-slate-500 mb-4">Perform side-by-side reviews mapping algorithmic trade-offs, dataset sizes, and numerical metrics across two distinct documents.</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div>
                      <label className="block text-xs font-mono text-slate-500 uppercase mb-1">Paper A</label>
                      <select
                        value={comparePaperIdA}
                        onChange={(e) => setComparePaperIdA(e.target.value)}
                        className="bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 w-full focus:outline-none"
                      >
                        <option value="">-- Select Paper A --</option>
                        {papers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-500 uppercase mb-1">Paper B</label>
                      <select
                        value={comparePaperIdB}
                        onChange={(e) => setComparePaperIdB(e.target.value)}
                        className="bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 w-full focus:outline-none"
                      >
                        <option value="">-- Select Paper B --</option>
                        {papers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div className="pt-5">
                      <button
                        onClick={triggerComparison}
                        disabled={!comparePaperIdA || !comparePaperIdB || comparePaperIdA === comparePaperIdB || isLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition disabled:opacity-50 w-full flex items-center justify-center space-x-2"
                      >
                        <GitCompare className="w-4 h-4" />
                        <span>Perform Comparative Audit</span>
                      </button>
                    </div>
                  </div>
                </div>

                {compareResult && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-slate-500 font-semibold">Comparative Analysis Results</span>
                      <button
                        onClick={() => downloadReport("Comparative_Audit", compareResult)}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-6 max-w-4xl mx-auto prose prose-slate">
                      {formatMarkdown(compareResult)}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 5. LITERATURE REVIEW TAB */}
            {activeTab === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-base font-bold font-display text-slate-900 mb-2">Automated Literature Synthesizer</h3>
                  <p className="text-xs text-slate-500 mb-4 font-normal">Select multiple indexed papers, specify a customized synthesis theme, and generate a cohesive, publication-quality literature review essay.</p>

                  <div className="space-y-4">
                    {/* Checklist of Papers */}
                    <div>
                      <span className="block text-xs font-mono text-slate-500 uppercase mb-2">Select papers to combine ({reviewPaperIds.length} selected):</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {papers.map((p) => {
                          const isSelected = reviewPaperIds.includes(p.id);
                          return (
                            <div 
                              key={p.id}
                              onClick={() => {
                                if (isSelected) {
                                  setReviewPaperIds(reviewPaperIds.filter(id => id !== p.id));
                                } else {
                                  setReviewPaperIds([...reviewPaperIds, p.id]);
                                }
                              }}
                              className={`p-3 rounded-lg border text-xs font-medium cursor-pointer transition ${
                                isSelected 
                                  ? "bg-indigo-600/10 border-indigo-500 text-indigo-700" 
                                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                              }`}
                            >
                              📄 {p.name}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Topic input */}
                    <div>
                      <label className="block text-xs font-mono text-slate-500 uppercase mb-1">Focus Theme / Topic</label>
                      <input
                        type="text"
                        value={reviewTopic}
                        onChange={(e) => setReviewTopic(e.target.value)}
                        placeholder="e.g. Scaling limits of attention mechanisms, parameters sizes, or performance profiles"
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      onClick={triggerReview}
                      disabled={reviewPaperIds.length === 0 || !reviewTopic.trim() || isLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Compass className="w-4 h-4" />
                      <span>Compile Literature Review</span>
                    </button>
                  </div>
                </div>

                {reviewResult && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-slate-500 font-semibold">Synthesis Review: {reviewTopic}</span>
                      <button
                        onClick={() => downloadReport("Literature_Review", reviewResult)}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-6 max-w-4xl mx-auto prose prose-slate">
                      {formatMarkdown(reviewResult)}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 6. QUIZ GENERATOR TAB */}
            {activeTab === "quiz" && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-base font-bold font-display text-slate-900 mb-2">Comprehension & Quiz Generator</h3>
                  <p className="text-xs text-slate-500 mb-4">Synthesize exactly 5 challenging multiple-choice questions (MCQs) and 3 subjective model evaluations to gauge knowledge extraction depth.</p>

                  <div className="flex items-center space-x-3">
                    <select
                      value={quizPaperId}
                      onChange={(e) => setQuizPaperId(e.target.value)}
                      className="bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2 w-72 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose a Paper --</option>
                      {papers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    <button
                      onClick={triggerQuiz}
                      disabled={!quizPaperId || isLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Award className="w-4 h-4" />
                      <span>Assemble Assessment</span>
                    </button>
                  </div>
                </div>

                {quizResult && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-slate-500 font-semibold">Assessment & Answer Rubrics</span>
                      <button
                        onClick={() => downloadReport("Academic_Quiz", quizResult)}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-6 max-w-4xl mx-auto prose prose-slate">
                      {formatMarkdown(quizResult)}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
        
      </div>
      
    </div>
  );
}
