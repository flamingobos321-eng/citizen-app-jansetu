import type { ReactNode } from "react";

type PagePanelProps = {
  title?: string;
  eyebrow?: string;
  page?: string;
  tone?: "paper" | "dark";
  children: ReactNode;
};

export default function PagePanel({ title, eyebrow = "JanSetu", page, tone = "paper", children }: PagePanelProps) {
  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="panel-stage">
        <main className={`page-panel ${tone === "dark" ? "page-panel--dark" : ""}`}>
          <div className="page-head">
            <span>{eyebrow}</span>
            <span>{page}</span>
          </div>
          {title ? <h1 className="page-title">{title}</h1> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
