import { useState } from "react";
import { Switch, Route, Link } from "wouter";
import UploadPage from "./pages/upload";

function HomePage() {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "24px",
          padding: "3rem 4rem",
          textAlign: "center",
          boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
          maxWidth: "480px",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "3.5rem",
            fontWeight: 800,
            color: "#ffffff",
            margin: 0,
            marginBottom: "0.5rem",
            letterSpacing: "2px",
            textShadow: "0 0 40px rgba(99,179,237,0.5)",
          }}
        >
          مرحبا
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "1rem",
            marginBottom: "2.5rem",
            marginTop: "0.5rem",
          }}
        >
          اضغط على الزر لاستقبال التحية
        </p>

        <button
          onClick={() => setMessage("أهلاً وسهلاً بك! يسعدنا وجودك هنا.")}
          style={{
            background: "linear-gradient(135deg, #63b3ed, #4299e1)",
            color: "#fff",
            border: "none",
            borderRadius: "14px",
            padding: "0.9rem 2.5rem",
            fontSize: "1.15rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(66,153,225,0.4)",
            letterSpacing: "0.5px",
            display: "block",
            width: "100%",
            marginBottom: "1rem",
          }}
        >
          اضغط هنا
        </button>

        <Link
          to="/upload"
          style={{
            display: "block",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#bee3f8",
            borderRadius: "14px",
            padding: "0.75rem 2rem",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          📄 رفع ملف PDF
        </Link>

        {message && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem 1.5rem",
              background: "rgba(99,179,237,0.15)",
              border: "1px solid rgba(99,179,237,0.35)",
              borderRadius: "12px",
              color: "#bee3f8",
              fontSize: "1.05rem",
              fontWeight: 500,
              animation: "fadeIn 0.3s ease",
            }}
          >
            {message}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function App() {
  return (
    <Switch>
      <Route path="/upload" component={UploadPage} />
      <Route path="/" component={HomePage} />
    </Switch>
  );
}

export default App;
