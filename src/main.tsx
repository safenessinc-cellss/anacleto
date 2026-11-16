import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import PublicLanding from "./components/PublicLanding";
import "./index.css";
import { ToastProvider } from "./components/ToastContext.tsx";
import ErrorBoundary from "./components/ErrorBoundary";
import PublicProposalPage from "./components/quotes/PublicProposalPage";

const isPublicProposal = /^\/proposta\/[^/]+$/.test(window.location.pathname);
const isManagement = window.location.pathname === "/gestao" || window.location.pathname.startsWith("/gestao/");

createRoot(document.getElementById("root")!).render(
  isPublicProposal ? <PublicProposalPage /> :
  isManagement ? (
    <StrictMode><ToastProvider><ErrorBoundary><App /></ErrorBoundary></ToastProvider></StrictMode>
  ) : <PublicLanding />
);
