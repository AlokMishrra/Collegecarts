import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  logLevel: 'info',
  plugins: [
    react({
      // Enable Fast Refresh for better DX
      fastRefresh: true,
      // Optimize JSX runtime
      jsxRuntime: 'automatic',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['baseline-browser-mapping'],
    // Pre-bundle heavy dependencies for faster dev server startup
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'framer-motion',
      'lucide-react',
    ],
  },
  build: {
    // Optimize build output
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    sourcemap: false,
    // Reduce initial bundle size
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks(id) {
          // React core - smallest possible
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/react-router-dom/') || id.includes('node_modules/@remix-run/')) {
            return 'router-vendor';
          }
          // UI framework - loaded early
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }
          // Icons - separate chunk (large)
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons-vendor';
          }
          // Animation - can be deferred
          if (id.includes('node_modules/framer-motion/')) {
            return 'animation-vendor';
          }
          // Charts - only needed on specific pages
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
            return 'chart-vendor';
          }
          // Supabase
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase-vendor';
          }
          // Forms
          if (id.includes('node_modules/react-hook-form/') || id.includes('node_modules/@hookform/') || id.includes('node_modules/zod/')) {
            return 'form-vendor';
          }
          // Heavy libs - lazy loaded
          if (id.includes('node_modules/xlsx/')) {
            return 'xlsx-vendor';
          }
          if (id.includes('node_modules/html2canvas/') || id.includes('node_modules/jspdf/')) {
            return 'pdf-vendor';
          }
          if (id.includes('node_modules/qrcode/')) {
            return 'qrcode-vendor';
          }
          if (id.includes('node_modules/bcryptjs/')) {
            return 'crypto-vendor';
          }
          // Tanstack query
          if (id.includes('node_modules/@tanstack/')) {
            return 'query-vendor';
          }
        }
      }
    }
  },
  // Optimize server for development
  server: {
    hmr: {
      overlay: true,
    },
  },
})
