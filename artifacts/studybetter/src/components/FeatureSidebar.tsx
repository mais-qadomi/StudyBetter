import { FEATURES_REGISTRY, type FeatureDef, type FeatureType } from "../lib/features-registry.tsx";
import type { FeatureResultData } from "../lib/storage";
import { Check, X, ChevronLeft, Loader2, FileText } from "lucide-react";

interface FeatureSidebarProps {
  results: FeatureResultData[];
  availableFeatures: { type: string; status: "live" | "coming_soon"; alreadyApplied: boolean }[];
  activeFeatureType: string | null;
  onSelectFeature: (type: string) => void;
  onApplyFeature: (type: FeatureType) => void;
  applying: boolean;
}

export default function FeatureSidebar({
  results,
  availableFeatures,
  activeFeatureType,
  onSelectFeature,
  onApplyFeature,
  applying,
}: FeatureSidebarProps) {
  const getDef = (type: string): FeatureDef | undefined =>
    FEATURES_REGISTRY.find(f => f.type === type);

  const appliedResults = results.filter(r => r.status === "completed");
  const failedResults = results.filter(r => r.status === "failed");
  const processingResults = results.filter(r => r.status === "processing");

  const sortedFeatures = [...availableFeatures].sort((a, b) => {
    const aApplied = a.alreadyApplied || processingResults.some(r => r.featureType === a.type) || failedResults.some(r => r.featureType === a.type);
    const bApplied = b.alreadyApplied || processingResults.some(r => r.featureType === b.type) || failedResults.some(r => r.featureType === b.type);
    if (aApplied && !bApplied) return -1;
    if (!aApplied && bApplied) return 1;
    if (a.status === "live" && b.status === "coming_soon") return -1;
    if (a.status === "coming_soon" && b.status === "live") return 1;
    return 0;
  });

  return (
    <div style={{
      width: "280px", flexShrink: 0,
      background: "var(--app-card)", borderRadius: "16px",
      border: "1.5px solid var(--app-border)",
      padding: "1.2rem",
      display: "flex", flexDirection: "column", gap: "0.5rem",
      height: "fit-content", position: "sticky", top: "5rem",
    }}>
      <p style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--app-text)", margin: "0 0 0.5rem", textAlign: "center" }}>
        شو ممكن تسوي بهذا الملف؟
      </p>

      {sortedFeatures.map(f => {
        const def = getDef(f.type);
        const result = results.find(r => r.featureType === f.type);
        const isProcessing = processingResults.some(r => r.featureType === f.type);
        const isFailed = failedResults.some(r => r.featureType === f.type);
        const isActive = activeFeatureType === f.type;
        const isLive = f.status === "live";
        const isApplied = f.alreadyApplied;

        return (
          <div key={f.type}
            onClick={() => {
              if (isApplied && !isFailed) onSelectFeature(f.type);
            }}
            style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              padding: "0.7rem 0.9rem", borderRadius: "10px",
              background: isActive ? "var(--app-accent-bg)" : isApplied && !isFailed ? "var(--app-block-success-bg)" : "var(--app-bg)",
              border: isActive ? "1.5px solid var(--app-accent-light)" : isApplied && !isFailed ? "1.5px solid var(--app-block-success-border)" : "1.5px solid var(--app-border)",
              cursor: isLive && !isProcessing && !isFailed ? "pointer" : "default",
              opacity: !isLive ? 0.55 : 1,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: "1.3rem", display: "inline-flex" }}>{def?.icon ?? <FileText size={20} />}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--app-text)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                {def?.label ?? f.type}
                {!isLive && (
                  <span style={{ fontSize: "0.65rem", background: "var(--app-bg)", color: "var(--app-muted)", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 700 }}>قريباً</span>
                )}
                {isApplied && !isFailed && (
                  <span style={{ fontSize: "0.7rem", color: "var(--app-success)" }}><Check size={16} /></span>
                )}
                {isFailed && (
                  <span style={{ fontSize: "0.7rem", color: "var(--app-danger)" }}><X size={16} /></span>
                )}
              </div>
              {def?.description && (
                <div style={{ fontSize: "0.72rem", color: "var(--app-muted)", marginTop: "2px", lineHeight: 1.3 }}>{def.description}</div>
              )}
            </div>
            {isProcessing && (
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "var(--app-accent)" }} />
            )}
            {isLive && !isApplied && !isProcessing && !isFailed && (
              <button
                onClick={(e) => { e.stopPropagation(); onApplyFeature(f.type as FeatureType); }}
                disabled={applying}
                style={{
                  background: "var(--app-accent)", color: "#fff", border: "none",
                  borderRadius: "6px", padding: "0.3rem 0.6rem",
                  fontSize: "0.75rem", fontWeight: 700, cursor: applying ? "wait" : "pointer",
                  fontFamily: "inherit", whiteSpace: "nowrap",
                }}
              >
                {applying ? "..." : "طبّق"}
              </button>
            )}
            {isFailed && (
              <button
                onClick={(e) => { e.stopPropagation(); onApplyFeature(f.type as FeatureType); }}
                disabled={applying}
                style={{
                  background: "var(--app-danger)", color: "#fff", border: "none",
                  borderRadius: "6px", padding: "0.3rem 0.6rem",
                  fontSize: "0.7rem", fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                إعادة
              </button>
            )}
            {isApplied && !isFailed && result?.status === "completed" && (
              <span style={{ fontSize: "1rem", color: "var(--app-muted)" }}><ChevronLeft size={16} /></span>
            )}
          </div>
        );
      })}
    </div>
  );
}
