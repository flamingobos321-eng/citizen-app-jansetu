import type { ReactNode } from "react";

type PagePanelProps = {
  title?: string;
  eyebrow?: string;
  tone?: "paper" | "blue" | "cobalt" | "navy";
  children: ReactNode;
};

export default function PagePanel({
  title,
  eyebrow = "JANSETU · CONSTITUENCY SERVICES",
  tone = "paper",
  children,
}: PagePanelProps) {
  const toneClass =
    tone === "cobalt"
      ? "page-panel--cobalt"
      : tone === "navy"
        ? "page-panel--navy"
        : tone === "blue"
          ? "page-panel--blue"
          : "";

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="panel-stage">
        <main className={`page-panel ${toneClass}`}>
          <div className="page-topline">{eyebrow}</div>
          {title ? <h1 className="page-title">{title}</h1> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
