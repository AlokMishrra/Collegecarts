import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logErrorToDB } from '@/utils/supabaseWithLogging';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  async componentDidCatch(error, errorInfo) {
    console.error('Global Error Boundary caught error:', error, errorInfo);
    
    // Check if browser is online
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    // Gather system and user tracking info
    const pageUrl = window.location.href;
    const userAgent = navigator.userAgent;
    const isMobile = /mobile/i.test(userAgent);
    
    // Check if Clarity is running and log its metadata
    let claritySessionId = 'none';
    try {
      if (window.clarity) {
        // Microsoft Clarity session tracking if available
        claritySessionId = window.clarity.sessionId || 'active';
      }
    } catch (_) {}

    const detailedMessage = `[Clarity ID: ${claritySessionId}] [Online: ${isOnline}] [Mobile: ${isMobile}] [URL: ${pageUrl}] - ${error?.message || 'Unknown Global Error'}`;
    const stackTrace = `${error?.stack || ''}\n\nComponent Stack:\n${errorInfo?.componentStack || ''}\n\nUserAgent: ${userAgent}`;

    // Securely report the crash to Supabase DB
    logErrorToDB(
      isOnline ? 'GlobalCrash' : 'OfflineGlobalCrash',
      detailedMessage,
      window.location.pathname,
      stackTrace
    );
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnlineStatus);
    window.addEventListener('offline', this.handleOnlineStatus);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnlineStatus);
    window.removeEventListener('offline', this.handleOnlineStatus);
  }

  handleOnlineStatus = () => {
    this.setState({ isOnline: navigator.onLine });
  };

  render() {
    if (this.state.hasError) {
      const isOnline = this.state.isOnline;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
          <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            {isOnline ? (
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <WifiOff className="w-8 h-8 text-emerald-600" />
              </div>
            )}

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isOnline ? 'System Optimizing' : 'Network Disconnected'}
            </h1>
            
            <p className="text-gray-500 mb-8 text-sm leading-relaxed max-w-sm mx-auto">
              {isOnline 
                ? 'We encountered an error loading components. Tap reload to start a fresh session with full features.' 
                : 'It looks like you are offline. Please check your internet connection and try reloading.'}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-xs mx-auto">
              <Button
                onClick={() => window.location.reload(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </Button>
              
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                variant="outline"
                className="border-gray-200 hover:bg-gray-50 text-gray-700 font-medium"
              >
                Go to Home
              </Button>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="mt-8 p-4 bg-red-50 rounded-lg text-left text-xs text-red-600 overflow-auto max-h-40 font-mono border border-red-100">
                <strong>Dev Stack Trace:</strong>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error.stack}</pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
