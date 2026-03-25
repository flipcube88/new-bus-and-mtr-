import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMsg = '發生未知錯誤';
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMsg = parsed.error;
          }
        }
      } catch (e) {
        errorMsg = this.state.error?.message || errorMsg;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">應用程式發生錯誤</h2>
            <p className="text-sm text-gray-500 mb-8 break-words">{errorMsg}</p>
            <button
              className="bg-red-500 text-white font-black px-8 py-4 rounded-2xl shadow-lg active:scale-95 transition-all w-full"
              onClick={() => window.location.reload()}
            >
              重新載入
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
