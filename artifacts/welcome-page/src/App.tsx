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
        background: "linear-gradient(135deg, #e8f4fb 0%, #fce4f0 50%, #e4f7ec 100%)",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #d8eaf7",
          borderRadius: "24px",
          padding: "3rem 4rem",
          textAlign: "center",
          boxShadow: "0 12px 40px rgba(168,208,240,0.3)",
          maxWidth: "480px",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "3.5rem",
            fontWeight: 800,
            color: "#5a8fc7",
            margin: 0,
            marginBottom: "0.5rem",
            letterSpacing: "2px",
            textShadow: "0 2px 16px rgba(100,160,220,0.25)",
          }}
        >
          مرحبا
        </h1>
        <p
          style={{
            color: "#9ab8d8",
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
            background: "linear-gradient(135deg, #a8d8f0, #88bce8)",
            color: "#fff",
            border: "none",
            borderRadius: "14px",
            padding: "0.9rem 2.5rem",
            fontSize: "1.15rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(136,188,232,0.45)",
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
            background: "linear-gradient(135deg, #f0c8e0, #e8a8d0)",
            color: "#fff",
            borderRadius: "14px",
            padding: "0.85rem 2rem",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: "pointer",
            textDecoration: "none",
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(232,168,208,0.4)",
          }}
        >
          📄 رفع ملف PDF
        </Link>

        {message && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem 1.5rem",
              background: "#e8f8f0",
              border: "1px solid #a8e0c8",
              borderRadius: "12px",
              color: "#4a9a78",
              fontSize: "1.05rem",
              fontWeight: 600,
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
