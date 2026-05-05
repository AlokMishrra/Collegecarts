import { base44 } from "@/api/base44Client";

/**
 * Log errors to the error_logs table in Supabase.
 * Fully safe — never throws, never breaks the calling code.
 */
export const logErrorToDB = async (errorType, message, page, stackTrace = '') => {
  // Guard: if base44.client isn't ready, skip silently
  if (!base44?.client?.from) {
    return;
  }

  try {
    let userId = null;
    try {
      const currentUser = await base44.auth.getUser();
      userId = currentUser?.id || null;
    } catch (_) {
      // Not logged in — fine
    }

    const { error } = await base44.client
      .from('error_logs')
      .insert({
        error_type: errorType,
        message: String(message || '').slice(0, 500),
        user_id: userId,
        page: page || (typeof window !== 'undefined' ? window.location.pathname : '/'),
        stack_trace: String(stackTrace || '').slice(0, 2000),
        resolved: false
      });

    // If table doesn't exist yet, fail silently
    if (error && (error.code === '42P01' || error.message?.includes('relation'))) {
      return;
    }
  } catch (_) {
    // Never let logging break the app
  }
};

/**
 * Wrapper for async calls that automatically logs errors.
 */
export const withErrorLogging = async (fn, context = 'Unknown') => {
  try {
    return await fn();
  } catch (error) {
    let errorType = 'Runtime';
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      errorType = 'Network';
    } else if (error.code || error.status) {
      errorType = 'API';
    }

    await logErrorToDB(
      errorType,
      `${context}: ${error.message || 'Unknown error'}`,
      typeof window !== 'undefined' ? window.location.pathname : '/',
      error.stack || ''
    );

    throw error;
  }
};
