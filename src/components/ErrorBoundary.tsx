import { Component, type ReactNode, type ErrorInfo } from 'react';
import { logger } from '../lib/logger';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child component tree
 *
 * Features:
 * - Catches errors during rendering, lifecycle methods, and constructors
 * - Logs errors with full stack trace for debugging
 * - Displays user-friendly fallback UI with reset option
 * - Supports custom fallback UI via props
 * - Automatically resets on navigation or retry
 *
 * Note: Error boundaries do NOT catch errors in:
 * - Event handlers (use try/catch instead)
 * - Asynchronous code (setTimeout, requestAnimationFrame)
 * - Server-side rendering
 * - Errors thrown in the error boundary itself
 *
 * @example
 * // Wrap entire app
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 *
 * @example
 * // With custom fallback
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so next render shows fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error with full context for debugging
    logger.error('React Error Boundary caught an error', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-red-600" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-stone-900 text-center mb-3">
              Something went wrong
            </h1>

            {/* Description */}
            <p className="text-stone-600 text-center mb-6">
              The application encountered an unexpected error. Don't worry — your data is safe.
              Try refreshing the page or return to the home screen.
            </p>

            {/* Error Details (Development Mode) */}
            {import.meta.env.DEV && error && (
              <details className="mb-6 bg-stone-50 rounded-lg p-4 border border-stone-200">
                <summary className="cursor-pointer font-semibold text-stone-700 text-sm mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-stone-700">Error:</span>
                    <pre className="mt-1 p-2 bg-white rounded border border-stone-200 overflow-x-auto text-red-600">
                      {error.message}
                    </pre>
                  </div>
                  {error.stack && (
                    <div>
                      <span className="font-semibold text-stone-700">Stack Trace:</span>
                      <pre className="mt-1 p-2 bg-white rounded border border-stone-200 overflow-x-auto text-stone-600 max-h-40">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div>
                      <span className="font-semibold text-stone-700">Component Stack:</span>
                      <pre className="mt-1 p-2 bg-white rounded border border-stone-200 overflow-x-auto text-stone-600 max-h-40">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={this.handleReset}
                className="w-full h-12 bg-stone-900 hover:bg-stone-800 text-white font-semibold"
              >
                Try Again
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full h-12 border-2 font-medium"
              >
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
