import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import PublicLanding from "./components/PublicLanding";
import "./index.css";

const ManagementApp = lazy(() => import("./App.tsx"));
const PublicProposalPage = lazy(() => import("./components/quotes/PublicProposalPage"));
const { ToastProvider } = await import("./components/ToastContext.tsx");
const { default: ErrorBoundary } = await import("./components/ErrorBoundary");

const isPublicProposal = /^\/proposta\/[^/]+$/.test(window.location.pathname);
const isManagement = window.location.pathname === "/gestao" || window.location.pathname.startsWith("/gestao/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div style={{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"system-ui",color:"#526879"}}>Carregando…</div>}>
      {isPublicProposal ? <PublicProposalPage /> :
       isManagement ? <ToastProvider><ErrorBoundary><ManagementApp /></ErrorBoundary></ToastProvider> :
       <PublicLanding />}
    </Suspense>
  </StrictMode>
);
