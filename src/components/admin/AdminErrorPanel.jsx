import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function AdminErrorPanel() {
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, API, Runtime, Network, unresolved
  const [tableNotFound, setTableNotFound] = useState(false);

  useEffect(() => {
    loadErrors();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadErrors, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadErrors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await base44.client
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTableNotFound(false);
      setErrors(data || []);
    } catch (error) {
      console.error("Error loading error logs:", error);
      // Check if the table doesn't exist
      if (
        error?.message?.includes('relation') ||
        error?.message?.includes('does not exist') ||
        error?.code === '42P01'
      ) {
        setTableNotFound(true);
      } else {
        toast.error("Failed to load error logs");
      }
    }
    setIsLoading(false);
  };

  const resolveError = async (errorId) => {
    try {
      const { error } = await base44.client
        .from('error_logs')
        .update({ resolved: true })
        .eq('id', errorId);

      if (error) throw error;

      setErrors(prev => prev.map(e => 
        e.id === errorId ? { ...e, resolved: true } : e
      ));
      toast.success("Error marked as resolved");
    } catch (error) {
      console.error("Error resolving error:", error);
      toast.error("Failed to resolve error");
    }
  };

  const clearResolved = async () => {
    if (!confirm("Delete all resolved errors? This cannot be undone.")) return;

    try {
      const { error } = await base44.client
        .from('error_logs')
        .delete()
        .eq('resolved', true);

      if (error) throw error;

      setErrors(prev => prev.filter(e => !e.resolved));
      toast.success("Resolved errors cleared");
    } catch (error) {
      console.error("Error clearing resolved errors:", error);
      toast.error("Failed to clear resolved errors");
    }
  };

  const clearAll = async () => {
    if (!confirm("Delete ALL error logs? This cannot be undone.")) return;

    try {
      const { error } = await base44.client
        .from('error_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      setErrors([]);
      toast.success("All errors cleared");
    } catch (error) {
      console.error("Error clearing all errors:", error);
      toast.error("Failed to clear all errors");
    }
  };

  const getErrorBadgeColor = (type) => {
    switch (type) {
      case 'API':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'Runtime':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'Network':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const filteredErrors = errors.filter(error => {
    if (filter === 'all') return true;
    if (filter === 'unresolved') return !error.resolved;
    return error.error_type === filter;
  });

  const unresolvedCount = errors.filter(e => !e.resolved).length;

  if (isLoading && errors.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SQL Setup Banner — shown when error_logs table doesn't exist */}
      {tableNotFound && (
        <div style={{
          background: '#FEF9C3',
          border: '1px solid #CA8A04',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <strong style={{ color: '#92400E' }}>⚠️ One-Time Setup Required</strong>
          <p style={{ color: '#78350F', margin: '8px 0', fontSize: '13px' }}>
            Run this SQL in your Supabase SQL Editor to enable error logging:
          </p>
          <pre style={{
            background: '#1E1B4B',
            color: '#A5B4FC',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '11px',
            overflowX: 'auto',
            userSelect: 'all'
          }}>{`CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  error_type TEXT NOT NULL,
  message TEXT,
  user_id UUID,
  page TEXT,
  stack_trace TEXT,
  resolved BOOLEAN DEFAULT FALSE
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view" ON error_logs FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

CREATE POLICY "Public insert" ON error_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);`}</pre>
          <p style={{ fontSize: '12px', color: '#92400E', marginTop: '8px' }}>
            After running the SQL above, refresh this page. ↺
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            Error Logs
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filteredErrors.length} error{filteredErrors.length !== 1 ? 's' : ''}
            {unresolvedCount > 0 && (
              <span className="ml-2 text-red-600 font-semibold">
                ({unresolvedCount} unresolved)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadErrors}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={clearResolved}
            variant="outline"
            size="sm"
            className="text-orange-600 hover:text-orange-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Resolved
          </Button>
          <Button
            onClick={clearAll}
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'unresolved', 'API', 'Runtime', 'Network'].map(f => (
          <Button
            key={f}
            onClick={() => setFilter(f)}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            className={filter === f ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'unresolved' && unresolvedCount > 0 && (
              <Badge className="ml-2 bg-red-600">{unresolvedCount}</Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Error Table */}
      {filteredErrors.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              ✅ No errors logged
            </h3>
            <p className="text-gray-600">System is healthy.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Message</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Page</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredErrors.map(error => (
                    <tr 
                      key={error.id}
                      className={error.resolved ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}
                    >
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(error.created_at).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getErrorBadgeColor(error.error_type)}>
                          {error.error_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                        <div className={error.resolved ? 'line-through' : ''}>
                          {error.message || 'No message'}
                        </div>
                        {error.stack_trace && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              Stack trace
                            </summary>
                            <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                              {error.stack_trace}
                            </pre>
                          </details>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {error.page || 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        {error.resolved ? (
                          <Badge className="bg-green-100 text-green-700 border-green-300">
                            ✓ Resolved
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-300">
                            Unresolved
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!error.resolved && (
                          <Button
                            onClick={() => resolveError(error.id)}
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
