import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside Ferricar:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-xl border border-gray-200 border-l-4 border-l-brand-red shadow-xl max-w-md w-full">
            <div className="w-16 h-16 bg-brand-red-soft rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-red-soft">
              <AlertTriangle className="w-8 h-8 text-brand-red" />
            </div>
            <h2 className="font-display font-bold text-gray-900 text-lg mb-2">
              Algo no salió como se esperaba
            </h2>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Ocurrió un error inesperado en la interfaz. Hemos registrado los detalles del problema. Puedes intentar restablecer la aplicación.
            </p>
            {this.state.error && (
              <div className="bg-brand-red-soft/30 text-[10px] text-brand-red font-mono p-3 rounded-lg border border-brand-red-soft mb-6 text-left overflow-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 bg-brand-red hover:bg-brand-red-hover text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restablecer y Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
