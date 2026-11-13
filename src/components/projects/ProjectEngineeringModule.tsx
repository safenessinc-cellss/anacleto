import React from "react";
import TechnicalDrawingModule from "../technical-drawing/TechnicalDrawingModule";
import { SenderConfig } from "../../types";

export default function ProjectEngineeringModule({ language, senderConfig }: { language: string; senderConfig: SenderConfig }) {
  return (
    <section className="space-y-6 text-slate-900 dark:text-slate-100">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Projetos & Oficina CAD</h1>
      </header>
      <TechnicalDrawingModule language={language} senderConfig={senderConfig} />
    </section>
  );
}
