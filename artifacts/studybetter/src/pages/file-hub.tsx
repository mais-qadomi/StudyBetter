import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import {
  apiGetSession, apiGetFileFeatures, apiApplyFeature,
  apiSavePage, apiSaveSession, savePdfToIDB,
  loadPdfFromIDB, type StoredSession, type FeaturesResponse,
} from "../lib/storage";
import { callExplain, type PageResultUI } from "../lib/explain";
import { type FeatureType } from "../lib/features-registry.tsx";
import { motion } from "framer-motion";
import RawFileViewer from "../components/RawFileViewer";
import FeatureSidebar from "../components/FeatureSidebar";
import FeatureResultView from "../components/FeatureResultView";
import ExplainFileView from "../components/ExplainFileView";
import { FileText, BookOpen, Sparkles, Brain, Layers, Globe, Loader2, AlertTriangle, ArrowRight, CheckCircle } from "lucide-react";

const C = {
  bg: "var(--app-bg)",
  text: "var(--app-text)",
  muted: "var(--app-muted)",
  accent: "var(--app-accent)",
  accentLight: "var(--app-accent-light)",
  accentBg: "var(--app-accent-bg)",
  border: "var(--app-border)",
  green: "var(--app-green)",
  red: "var(--app-red)",
};

const DELAY_BETWEEN_PAGES_MS = 6000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function FileHubPage() {
  const [, params] = useRoute("/files/:fileId");
  const [, navigate] = useLocation();
  const fileId = params?.fileId;

  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [featuresData, setFeaturesData] = useState<FeaturesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"viewer" | string>("viewer");
  const [applying, setApplying] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [pageResults, setPageResults] = useState<Record<number, PageResultUI>>({});
  const [explaining, setExplaining] = useState<Set<number>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const pageTextsRef = useRef<Record<number, string>>({});
  const pageTypesRef = useRef<Record<number, "text" | "image" | "mixed">>({});

  const resultByType = new Map(
    (featuresData?.results ?? []).map(r => [r.featureType, r]),
  );

  useEffect(() => {
    if (!fileId) { navigate("/", { replace: true }); return; }
    const load = async () => {
      setLoading(true); setError("");
      const data = await apiGetSession(fileId);
      if (!data) { setError("الملف غير موجود"); setLoading(false); return; }
      setSession(data.session);

      const features = await apiGetFileFeatures(fileId);
      setFeaturesData(features);

      const pdfFile = await loadPdfFromIDB(fileId);
      if (pdfFile) {
        setFile(pdfFile);
        setNumPages(data.session.numPages);
      }

      const texts: Record<number, string> = {};
      const results: Record<number, PageResultUI> = {};
      for (const p of data.pages) {
        if (p.extractedText) texts[p.pageNumber] = p.extractedText;
        if (p.explanation) {
          results[p.pageNumber] = { translation: p.translation ?? null, explanation: p.explanation, error: "" };
        }
      }
      pageTextsRef.current = texts;
      setPageTexts(texts);
      setPageResults(results);

      setLoading(false);

      if (features && features.results.length > 0) {
        const latest = features.results
          .filter(r => r.status === "completed")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (latest) setActiveTab(latest.featureType);
      }
    };
    void load();
  }, [fileId]);

  const handleApplyFeature = useCallback(async (featureType: FeatureType) => {
    if (!fileId || !featuresData) return;
    if (featureType === "explanation") {
      setActiveTab("explanation");
      return;
    }
    setApplying(true);
    const result = await apiApplyFeature(fileId, featureType, "");
    if (result) {
      const updated = await apiGetFileFeatures(fileId);
      if (updated) setFeaturesData(updated);
    }
    setApplying(false);
  }, [fileId, featuresData]);

  const handleTextReady = useCallback((pageNum: number, text: string, pageType?: "text" | "image" | "mixed") => {
    pageTextsRef.current[pageNum] = text;
    setPageTexts(prev => ({ ...prev, [pageNum]: text }));
    if (pageType) pageTypesRef.current[pageNum] = pageType;
    if (fileId) void apiSavePage(fileId, pageNum, { extractedText: text });
  }, [fileId]);

  const explainOnePage = useCallback(async (pageNum: number, imageDataUrl?: string) => {
    const text = pageTextsRef.current[pageNum] ?? "";
    if (!text && !imageDataUrl) {
      setPageResults(prev => ({
        ...prev,
        [pageNum]: { translation: null, explanation: "", error: "لم يُستخرج نص من هذه الصفحة. قد تكون الصفحة صورة فقط." },
      }));
      return;
    }
    setExplaining(prev => new Set(prev).add(pageNum));
    try {
      const result = await callExplain(text, imageDataUrl ? [imageDataUrl] : undefined);
      setPageResults(prev => ({ ...prev, [pageNum]: result }));
      if (fileId) {
        void apiSavePage(fileId, pageNum, {
          translation: result.translation ?? undefined,
          explanation: result.explanation,
        });
      }
    } catch (err: unknown) {
      setPageResults(prev => ({
        ...prev,
        [pageNum]: { translation: null, explanation: "", error: err instanceof Error ? err.message : "فشل الاتصال بالسيرفر" },
      }));
    } finally {
      setExplaining(prev => { const s = new Set(prev); s.delete(pageNum); return s; });
    }
  }, [fileId]);

  const handleExplainAll = useCallback(async () => {
    if (bulkProgress || numPages === 0) return;
    const toProcess: number[] = [];
    for (let i = 1; i <= numPages; i++) {
      if (!pageResults[i]?.explanation) toProcess.push(i);
    }
    if (toProcess.length === 0) return;
    const imagePages = toProcess.filter(pn => {
      const t = pageTypesRef.current[pn];
      const text = pageTextsRef.current[pn] ?? "";
      return (t === "image" || t === "mixed" || !text.trim()) && t !== "text";
    });
    const textPages = toProcess.filter(pn => !imagePages.includes(pn));
    for (let idx = 0; idx < textPages.length; idx++) {
      const pn = textPages[idx];
      setBulkProgress({ current: idx + 1, total: textPages.length });
      await explainOnePage(pn);
      if (idx < textPages.length - 1) await sleep(DELAY_BETWEEN_PAGES_MS);
    }
    setBulkProgress(null);
  }, [bulkProgress, numPages, pageResults, explainOnePage]);

  const hasAppliedExplanations = pageResults && Object.values(pageResults).some(r => r.explanation);
  const tabIcons: Record<string, React.ReactNode> = {
    viewer: <FileText size={20} />,
    explanation: <BookOpen size={20} />,
    summary: <Sparkles size={20} />,
    quiz: <Brain size={20} />,
    flashcards: <Layers size={20} />,
    translation: <Globe size={20} />,
  };
  const tabs: { id: string; label: string }[] = [];
  if (file) tabs.push({ id: "viewer", label: "الملف الأصلي" });
  if (hasAppliedExplanations || activeTab === "explanation") {
    if (!tabs.find(t => t.id === "explanation")) tabs.push({ id: "explanation", label: "الشرح" });
  }
  for (const r of featuresData?.results ?? []) {
    if (r.status === "completed" && r.featureType !== "explanation") {
      const labels: Record<string, string> = { summary: "التلخيص", quiz: "الاختبار", flashcards: "البطاقات", translation: "الترجمة" };
      if (!tabs.find(t => t.id === r.featureType)) tabs.push({ id: r.featureType, label: labels[r.featureType] ?? r.featureType });
    }
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} dir="rtl" style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', Tahoma, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: "1.3rem", color: C.muted }}><Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /> جاري تحميل الملف...</p>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} dir="rtl" style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', Tahoma, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1.2rem" }}>
        <p style={{ fontSize: "1.3rem", color: C.red, fontWeight: 700 }}><AlertTriangle size={24} style={{ verticalAlign: "middle" }} /> {error}</p>
        <button onClick={() => navigate("/")} style={{ padding: "0.65rem 2rem", borderRadius: "10px", border: "1px solid " + C.border, background: "var(--app-card)", cursor: "pointer", fontSize: "1.05rem", fontFamily: "inherit", color: C.text }}><ArrowRight size={22} style={{ verticalAlign: "middle" }} /> الرئيسية</button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} dir="rtl" style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', Tahoma, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{
        background: "var(--app-card)", borderBottom: "1.5px solid " + C.border,
        padding: "clamp(0.6rem, 2vw, 0.85rem) clamp(0.75rem, 3vw, 1.5rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: scrolled ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
        transition: "box-shadow 0.2s",
        flexWrap: "wrap", gap: "0.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0, flex: 1 }}>
          <button onClick={() => navigate("/")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.35rem", color: C.muted, padding: "0.35rem", fontFamily: "inherit", flexShrink: 0 }}><ArrowRight size={22} /></button>
          <span style={{ fontSize: "clamp(1rem, 3vw, 1.35rem)", fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {featuresData?.file.fileName ?? session?.fileName ?? "الملف"}
          </span>
          {hasAppliedExplanations && (
            <span style={{ fontSize: "0.9rem", background: "var(--app-block-success-bg)", color: "var(--app-green)", padding: "0.2rem 0.65rem", borderRadius: "8px", fontWeight: 700, flexShrink: 0 }}><CheckCircle size={15} style={{ verticalAlign: "middle" }} /> مشروح</span>
          )}
          {file && numPages > 0 && (
            <button
              onClick={() => navigate(`/files/${fileId}/studio`)}
              style={{
                fontSize: "0.85rem", background: "var(--app-accent-bg)", color: "var(--app-accent)",
                padding: "0.25rem 0.7rem", borderRadius: "8px", fontWeight: 700, flexShrink: 0,
                border: "1px solid var(--app-accent)", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              استوديو التعليقات
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1rem", width: "100%", boxSizing: "border-box" }}>
        {featuresData && (
          <div style={{ overflowX: "auto" }}>
            <FeatureSidebar
              results={featuresData.results}
              availableFeatures={featuresData.availableFeatures}
              activeFeatureType={activeTab === "viewer" ? null : activeTab}
              onSelectFeature={(type) => setActiveTab(type)}
              onApplyFeature={handleApplyFeature}
              applying={applying}
              compact
            />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {tabs.length > 1 && (
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", borderBottom: "1.5px solid " + C.border, paddingBottom: "0.4rem", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: "0.55rem 1rem", borderRadius: "10px 10px 0 0",
                    border: "none",                     background: activeTab === t.id ? "var(--app-card)" : "transparent",
                    color: activeTab === t.id ? C.accent : C.muted,
                    fontWeight: activeTab === t.id ? 700 : 500,
                    fontSize: "0.95rem", cursor: "pointer",
                    borderBottom: activeTab === t.id ? "2.5px solid " + C.accent : "2.5px solid transparent",
                    fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap",
                  }}
                  >{tabIcons[t.id]} {t.label}</button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", flex: 1 }}>
            {activeTab === "viewer" && file && (
              <RawFileViewer file={file} numPages={numPages} onNumPages={setNumPages} />
            )}
            {activeTab === "explanation" && file && (
              <ExplainFileView
                file={file}
                numPages={numPages}
                sessionId={fileId ?? ""}
                pageTexts={pageTexts}
                pageResults={pageResults}
                explaining={explaining}
                bulkProgress={bulkProgress}
                onNumPages={setNumPages}
                onTextReady={handleTextReady}
                onExplain={explainOnePage}
                onExplainAll={handleExplainAll}
              />
            )}
            {activeTab !== "viewer" && activeTab !== "explanation" && resultByType.has(activeTab) && (
              <FeatureResultView result={resultByType.get(activeTab)!} />
            )}
            {activeTab !== "viewer" && activeTab !== "explanation" && !resultByType.has(activeTab) && (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: C.muted }}>
                <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>لم يتم تطبيق هذه الميزة بعد</p>
                <p style={{ fontSize: "0.85rem" }}>اضغط على زر التطبيق أعلاه لتوليد النتائج</p>
              </div>
            )}
            {activeTab === "viewer" && !file && (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: C.muted }}>
                <p style={{ fontSize: "1.15rem", marginBottom: "0.5rem" }}>الملف غير متاح للمعاينة المباشرة</p>
                <p style={{ fontSize: "0.85rem" }}>يمكنك استخدام علامة التبويب "الشرح" لمراجعة المحتوى</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
