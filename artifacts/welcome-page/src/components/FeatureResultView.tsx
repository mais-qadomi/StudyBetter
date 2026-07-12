import type { FeatureResultData } from "../lib/storage";

interface FeatureResultViewProps {
  result: FeatureResultData;
}

export default function FeatureResultView({ result }: FeatureResultViewProps) {
  const parsed = (() => {
    if (!result.resultData) return null;
    try { return JSON.parse(result.resultData) as Record<string, unknown>; }
    catch { return null; }
  })();

  if (result.status === "processing") {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <p style={{ fontSize: "1.1rem", color: "var(--app-accent)", fontWeight: 700 }}>جاري التحميل...</p>
        <p style={{ fontSize: "0.9rem", color: "var(--app-muted)" }}>الميزة قيد المعالجة</p>
      </div>
    );
  }

  if (result.status === "failed") {
    const errMsg = parsed?.error ?? "حدث خطأ غير معروف";
    return (
      <div style={{ textAlign: "center", padding: "2rem 1rem", background: "var(--app-block-error-bg)", borderRadius: "12px", border: "1px solid var(--app-block-error-border)" }}>
        <p style={{ fontSize: "1rem", color: "var(--app-block-error-label)", fontWeight: 700 }}>فشلت المعالجة</p>
        <p style={{ fontSize: "0.9rem", color: "var(--app-muted)" }}>{String(errMsg)}</p>
      </div>
    );
  }

  if (result.featureType === "explanation" && parsed?.explanation) {
    const explanation = parsed.explanation as string;
    const blocks = explanation.split(/(\[H\].*?\[\/H\]|\[NOTE\].*?\[\/NOTE\]|\[PIN\].*?\[\/PIN\]|\[SUM\].*?\[\/SUM\]|\[EX\].*?\[\/EX\]|\[EN\].*?\[\/EN\])/gs);

    return (
      <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif", lineHeight: 1.8, maxWidth: "860px" }}>
        {blocks.map((block, idx) => {
          const hMatch = /^\[H\]([\s\S]*)\[\/H\]$/.exec(block);
          if (hMatch) return (
            <div key={idx} style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--app-text)", margin: "1.8rem 0 0.8rem", borderRight: "4px solid var(--app-accent)", paddingRight: "0.8rem" }}>
              {hMatch[1]}
            </div>
          );
          const noteMatch = /^\[NOTE\]([\s\S]*)\[\/NOTE\]$/.exec(block);
          if (noteMatch) return (
            <div key={idx} style={{ background: "var(--app-block-warning-bg)", border: "1px solid var(--app-block-warning-border)", borderRadius: "10px", padding: "0.8rem 1rem", margin: "0.8rem 0", fontSize: "0.92rem", color: "var(--app-block-warning-text)" }}>
              <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--app-block-warning-label)" }}>ملاحظة: </span>
              {noteMatch[1]}
            </div>
          );
          const pinMatch = /^\[PIN\]([\s\S]*)\[\/PIN\]$/.exec(block);
          if (pinMatch) return (
            <div key={idx} style={{ background: "var(--app-block-error-bg)", border: "1px solid var(--app-block-error-border)", borderRadius: "10px", padding: "0.8rem 1rem", margin: "0.8rem 0", fontSize: "0.92rem", color: "var(--app-block-error-text)" }}>
              <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--app-block-error-label)" }}>هام جداً للامتحان: </span>
              {pinMatch[1]}
            </div>
          );
          const sumMatch = /^\[SUM\]([\s\S]*)\[\/SUM\]$/.exec(block);
          if (sumMatch) return (
            <div key={idx} style={{ background: "var(--app-block-info-bg)", border: "1px solid var(--app-block-info-border)", borderRadius: "10px", padding: "0.8rem 1rem", margin: "0.8rem 0", fontSize: "0.92rem", color: "var(--app-block-info-text)" }}>
              <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--app-block-info-label)" }}>خلاصة: </span>
              {sumMatch[1]}
            </div>
          );
          const exMatch = /^\[EX\]([\s\S]*)\[\/EX\]$/.exec(block);
          if (exMatch) return (
            <div key={idx} style={{ background: "var(--app-block-tip-bg)", border: "1px solid var(--app-block-tip-border)", borderRadius: "10px", padding: "0.8rem 1rem", margin: "0.8rem 0", fontSize: "0.92rem", color: "var(--app-block-tip-text)" }}>
              <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--app-block-tip-label)" }}>مثال: </span>
              {exMatch[1]}
            </div>
          );
          const enMatch = /^\[EN\]([\s\S]*)\[\/EN\]$/.exec(block);
          if (enMatch) return (
            <span key={idx} style={{ fontWeight: 700, color: "var(--app-block-en-text)", fontFamily: "'Segoe UI', system-ui, sans-serif", unicodeBidi: "embed" }}>{enMatch[1]}</span>
          );
          if (!block.trim()) return null;
          return (
            <p key={idx} style={{ margin: "0.6rem 0", fontSize: "0.95rem", color: "var(--app-text)" }}>{block}</p>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", background: "var(--app-bg)", borderRadius: "12px", border: "1px solid var(--app-border)" }}>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", color: "var(--app-text)", margin: 0, direction: "rtl" }}>
        {result.resultData ?? "لا توجد بيانات"}
      </pre>
    </div>
  );
}
