import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logErrorToDB } from '@/utils/supabaseWithLogging';

export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Route boundary captured error:', error, errorInfo);
    
    // Log crash to database securely
    logErrorToDB(
      'RouteCrash',
      error?.message || 'Unknown Route Crash',
      window.location.pathname,
      `${error?.stack || ''}\n\nComponent Stack:\n${errorInfo?.componentStack || ''}`
    );
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] bg-white rounded-2xl border border-gray-100 shadow-sm my-6 mx-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <AlertTriangle className="w-8 h-8 text-emerald-600" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Page Loading Suspended
          </h2>
          
          <p className="text-sm text-gray-500 max-w-md mb-8 leading-relaxed">
            We ran into an unexpected issue while loading this section. This is often temporary and can be resolved by trying again or refreshing.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center">
            <Button
              onClick={this.handleTryAgain}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            
            <Button
              onClick={this.handleGoHome}
              variant="outline"
              className="border-gray-200 hover:bg-gray-50 text-gray-700 font-medium flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go to Home
            </Button>
          </div>
          
          {import.meta.env.DEV && this.state.error && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-left text-xs text-red-600 max-w-xl overflow-auto w-full font-mono max-h-40 border border-gray-100">
              <strong className="block mb-1">Developer Error Details:</strong>
              {this.state.error.toString()}
              <pre className="mt-2 whitespace-pre-wrap">{this.state.error.stack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
