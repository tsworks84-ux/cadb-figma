"use client";

import { useState } from "react";
import { X } from "lucide-react";

/** Form primitives shared by the assessments list page and the New Exam structure editor. */

// ── Design tokens ─────────────────────────────────────────────────────────────
export const D = { line: "#e6e8ef", muted: "#7c8598", ink: "#111827", nav2: "#28245f", bg: "#f4f6fa" };

export const inputBase: React.CSSProperties = {
  width: "100%", minHeight: 42, border: `1px solid ${D.line}`,
  borderRadius: 12, padding: "9px 12px", background: "white",
  color: D.ink, font: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box",
};

// ── Primitives ────────────────────────────────────────────────────────────────
export function DInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputBase, ...props.style }} />;
}
export function DSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputBase, ...props.style }}>{children}</select>;
}
export function DTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputBase, minHeight: 88, resize: "vertical", ...props.style }} />;
}
export function DBtn({ primary, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button {...props} style={{
      minHeight: 42, border: 0, borderRadius: 12, padding: "0 20px",
      font: "inherit", fontWeight: 850, cursor: props.disabled ? "not-allowed" : "pointer",
      ...(primary
        ? { background: "linear-gradient(135deg, #28245f, #4f46e5)", color: "white", boxShadow: "0 12px 24px rgba(79,70,229,.24)" }
        : { background: "white", color: "#374151", boxShadow: `inset 0 0 0 1px ${D.line}` }),
      opacity: props.disabled ? 0.6 : 1, ...props.style,
    }}>{children}</button>
  );
}
export function DField({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 7, alignContent: "start" }}>
      <label style={{ color: "#4b5563", fontSize: 13, fontWeight: 850 }}>
        {label}{req && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
export function SCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${D.line}`, borderRadius: 16, padding: 18, background: "#fbfcfe" }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800 }}>{title}</h2>
      {children}
    </div>
  );
}

// ── TopicsInput ───────────────────────────────────────────────────────────────
export function TopicsInput({ topics, onChange }: { topics: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (t && !topics.includes(t)) onChange([...topics, t]);
    setInput("");
  };
  return (
    <div>
      <div style={{ minHeight: 42, border: `1px solid ${D.line}`, borderRadius: 12, padding: "8px 12px", background: "white", display: "flex", flexWrap: "wrap", gap: 6 }}>
        {topics.length === 0 && <span style={{ color: D.muted, fontSize: 13, alignSelf: "center" }}>No topics added</span>}
        {topics.map((t) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, background: "#eef2ff", border: "1px solid #c7d2fe", padding: "2px 10px", fontSize: 12, fontWeight: 700, color: "#4338ca" }}>
            {t}
            <button type="button" onClick={() => onChange(topics.filter((x) => x !== t))} style={{ border: "none", background: "none", cursor: "pointer", color: "#a5b4fc", padding: 0, display: "flex" }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, marginTop: 10 }}>
        <DInput placeholder="Type a topic and press Add…" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <DBtn type="button" onClick={add} style={{ padding: "0 16px" }}>+ Add</DBtn>
      </div>
    </div>
  );
}

