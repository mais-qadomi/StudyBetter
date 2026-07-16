export function Skeleton({ width = "100%", height = "1rem", borderRadius = "8px", style = {} }: {
  width?: string; height?: string; borderRadius?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      width, height, borderRadius,
      background: "linear-gradient(90deg, var(--app-surface) 25%, var(--app-surface-elevated) 50%, var(--app-surface) 75%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shimmer 1.5s ease-in-out infinite",
      ...style,
    }} />
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      background: "var(--app-surface)", border: "1px solid var(--app-border)",
      borderRadius: "12px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem",
    }}>
      <Skeleton height="1.2rem" width="60%" />
      <Skeleton height="0.9rem" width="90%" />
      <Skeleton height="0.9rem" width="75%" />
      <Skeleton height="2rem" width="40%" borderRadius="8px" />
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div style={{
      minHeight: "60vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem",
    }}>
      <SkeletonCard />
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Skeleton width="80px" height="32px" borderRadius="8px" />
        <Skeleton width="80px" height="32px" borderRadius="8px" />
      </div>
    </div>
  );
}

export function SkeletonSpinner() {
  return (
    <div style={{
      minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: "1rem", color: "var(--app-muted)", fontSize: "0.85rem", fontWeight: 600,
    }}>
      <div style={{
        width: "28px", height: "28px", border: "3px solid var(--app-border)",
        borderTopColor: "var(--app-accent)", borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
