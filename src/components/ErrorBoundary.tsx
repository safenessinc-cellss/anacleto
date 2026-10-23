import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error Boundary capturou um erro:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md text-center shadow-lg">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Ops! Algo deu errado.
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Ocorreu um erro inesperado ao carregar a aplicação.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
            >
              Recarregar Página
            </button>
            {this.state.error && (
              <pre className="mt-4 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs text-left overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
