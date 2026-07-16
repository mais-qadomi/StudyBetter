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
  compact?: boolean;
}

export default function FeatureSidebar({
  results,
  availableFeatures,
  activeFeatureType,
  onSelectFeature,
  onApplyFeature,
  applying,
  compact,
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
      width: compact ? "100%" : "320px", flexShrink: 0,
      background: "var(--app-card)", borderRadius: "20px",
      border: "2px solid var(--app-border)",
      padding: compact ? "1rem" : "1.5rem",
      display: "flex", flexDirection: compact ? "row" : "column", gap: "0.65rem",
      height: "fit-content", position: compact ? undefined : "sticky", top: compact ? undefined : "5rem",
      flexWrap: "wrap",
      justifyContent: compact ? "center" : undefined,
    }}>
      <p style={{ fontSize: "1rem", fontWeight: 800, color: "var(--app-text)", margin: compact ? "0" : "0 0 0.6rem", textAlign: "center", width: compact ? "100%" : undefined }}>
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
              display: "flex", alignItems: "center", gap: compact ? "0.5rem" : "0.75rem",
              padding: compact ? "0.55rem 0.75rem" : "1.25rem 1.1rem",
              borderRadius: compact ? "10px" : "12px",
              background: isActive ? "var(--app-accent-bg)" : isApplied && !isFailed ? "var(--app-block-success-bg)" : "var(--app-bg)",
              border: isActive ? "1.5px solid var(--app-accent-light)" : isApplied && !isFailed ? "1.5px solid var(--app-block-success-border)" : "1.5px solid var(--app-border)",
              cursor: isLive && !isProcessing && !isFailed ? "pointer" : "default",
              opacity: !isLive ? 0.55 : 1,
              transition: "all 0.15s",
              flex: compact ? "1 1 auto" : undefined,
              minWidth: compact ? "120px" : undefined,
            }}
          >
            <span style={{ fontSize: compact ? "1.15rem" : "1.5rem", display: "inline-flex", flexShrink: 0 }}>{def?.icon ?? <FileText size={compact ? 18 : 24} />}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: compact ? "0.85rem" : "1rem", fontWeight: 700, color: "var(--app-text)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                {def?.label ?? f.type}
                {!isLive && (
                  <span style={{ fontSize: compact ? "0.65rem" : "0.75rem", background: "var(--app-bg)", color: "var(--app-muted)", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 700 }}>قريباً</span>
                )}
                {isApplied && !isFailed && (
                  <span style={{ fontSize: "0.85rem", color: "var(--app-success)" }}><Check size={16} /></span>
                )}
                {isFailed && (
                  <span style={{ fontSize: "0.85rem", color: "var(--app-danger)" }}><X size={16} /></span>
                )}
              </div>
              {def?.description && !compact && (
                <div style={{ fontSize: "0.85rem", color: "var(--app-muted)", marginTop: "3px", lineHeight: 1.4 }}>{def.description}</div>
              )}
            </div>
            {isProcessing && (
              <Loader2 size={compact ? 16 : 20} style={{ animation: "spin 1s linear infinite", color: "var(--app-accent)", flexShrink: 0 }} />
            )}
            {isLive && !isApplied && !isProcessing && !isFailed && (
              <button
                onClick={(e) => { e.stopPropagation(); onApplyFeature(f.type as FeatureType); }}
                disabled={applying}
                style={{
                  background: "var(--app-accent)", color: "#fff", border: "none",
                  borderRadius: "6px", padding: compact ? "0.3rem 0.6rem" : "0.4rem 0.85rem",
                  fontSize: compact ? "0.8rem" : "0.9rem", fontWeight: 700, cursor: applying ? "wait" : "pointer",
                  fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
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
                  borderRadius: "6px", padding: compact ? "0.3rem 0.6rem" : "0.4rem 0.85rem",
                  fontSize: compact ? "0.75rem" : "0.85rem", fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit", flexShrink: 0,
                }}
              >
                إعادة
              </button>
            )}
            {isApplied && !isFailed && result?.status === "completed" && (
              <span style={{ fontSize: "1.15rem", color: "var(--app-muted)", flexShrink: 0 }}><ChevronLeft size={18} /></span>
            )}
          </div>
        );
      })}
    </div>
  );
}
