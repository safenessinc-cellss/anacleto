import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ToastProvider } from './components/ToastContext.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { applyTheme, loadSavedTheme } from './utils/applyTheme';

const savedTheme = loadSavedTheme();
if (savedTheme) applyTheme(savedTheme);

// Respetar preferencia de modo guardada (light/dark)
const savedMode = localStorage.getItem("anacleto_theme_mode") || "light";
if (savedMode === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <ErrorBoundary>
      <App />
    </ErrorBoundary>
    </ToastProvider>
  </StrictMode>,
);
