import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";

interface DayData {
  key: string;
  minutes: number;
  label: string;
  isToday: boolean;
}

interface Props {
  data: DayData[];
}

export default function FocusChart({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div style={{
      background: "var(--app-card)", borderRadius: "20px", padding: "1.2rem 1.5rem",
      boxShadow: "var(--app-shadow)",
      border: "1.5px solid var(--app-border)",
      direction: "rtl",
    }}>
      <p style={{
        margin: "0 0 0.8rem", fontSize: "0.95rem", fontWeight: 700, color: "var(--app-text)",
        display: "flex", alignItems: "center", gap: "6px",
      }}>
        <BarChart3 size={18} color="var(--app-primary)" /> تركيزك خلال آخر 7 أيام
      </p>
      {data.every(d => d.minutes === 0) ? (
        <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--app-muted)", fontSize: "0.9rem" }}>
          <BarChart3 size={40} style={{ margin: "0 auto 0.5rem", opacity: 0.2 }} />
          لا توجد بيانات كافية بعد — ابدأ أول جلسة تركيز!
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--app-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, "dataMax + 5"]} />
            <Tooltip
              formatter={(value: number) => [`${value} دقيقة`, "التركيز"]}
              contentStyle={{
                background: "var(--app-card)", border: "1px solid var(--app-border)",
                borderRadius: "8px", fontSize: "12px",
              }}
            />
            <Bar
              dataKey="minutes"
              radius={[6, 6, 0, 0]}
              barSize={24}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; payload: DayData }) => {
                const { x, y, width, height, payload } = props;
                const color = payload.isToday
                  ? "url(#todayGrad)"
                  : "url(#defaultGrad)";
                return (
                  <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={color} />
                );
              }}
            />
            <defs>
              <linearGradient id="todayGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--app-primary-light)" />
                <stop offset="100%" stopColor="var(--app-primary)" />
              </linearGradient>
              <linearGradient id="defaultGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--app-primary-bg)" />
                <stop offset="100%" stopColor="var(--app-card-border)" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
