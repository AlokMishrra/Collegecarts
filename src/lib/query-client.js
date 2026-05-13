import { QueryClient } from '@tanstack/react-query';

/**
 * Optimized React Query configuration for CollegeCart
 * 
 * Key optimizations:
 * - Aggressive caching with staleTime
 * - Smart retry logic with exponential backoff
 * - Garbage collection for unused queries
 * - Network mode optimization
 */
export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			// Don't refetch on window focus - we have manual refresh controls
			refetchOnWindowFocus: false,
			
			// Don't refetch on reconnect - our cache is fresh enough
			refetchOnReconnect: false,
			
			// Don't refetch on mount if data is fresh
			refetchOnMount: false,
			
			// Retry failed requests with exponential backoff
			retry: 2,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
			
			// Consider data fresh for 60 seconds (matches our shop cache)
			staleTime: 60 * 1000,
			
			// Keep unused data in cache for 5 minutes
			cacheTime: 5 * 60 * 1000,
			
			// Network mode - online only (fail fast when offline)
			networkMode: 'online',
			
			// Structural sharing for better performance
			structuralSharing: true,
		},
		mutations: {
			// Retry mutations once on failure
			retry: 1,
			retryDelay: 1000,
			
			// Network mode for mutations
			networkMode: 'online',
		},
	},
});