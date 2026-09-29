import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { statSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { isSpaPath } from './spa-routes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow">
<title>Page not found — CollegeCart</title>
<style>
 body{margin:0;background:#FFFBF5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a}
 main{max-width:640px;margin:0 auto;padding:72px 24px;text-align:center}
 h1{font-size:34px;margin:0 0 12px;color:#0c831f}
 p{line-height:1.7;color:#475569;margin:0 0 24px}
 a{display:inline-block;background:#0c831f;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:600}
</style>
</head>
<body>
<main>
  <h1>404 — Page not found</h1>
  <p>The page you are looking for does not exist on CollegeCart. It may have moved, or the link may be mistyped. Browse the catalogue instead, or get help from support.</p>
  <a href="/Shop">Go to the shop</a>
</main>
</body>
</html>`;

/**
 * Serves the SPA shell for real routes and a genuine 404 for everything else,
 * in both `vite dev` and `vite preview`. Mirrors the rewrites in vercel.json.
 *
 * Vite's own HTML fallback hands index.html to *any* unknown URL — including
 * dot-paths such as /.well-known/ai-catalog.json — which is exactly the
 * catch-all 200 that makes agent discovery lookups read as soft 404s. So the
 * rule here is inverted: a path is served only if it is a declared app route
 * or it resolves to a file that actually exists on disk.
 */
function spaNotFound() {
  const middleware = (root, publicDir, outDir) => (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    let pathname
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
    } catch {
      pathname = req.url || '/'
    }

    // Vite internals, HMR and pre-bundled deps are never routes.
    if (/^\/(@|__vite|__open-in-editor)/.test(pathname)) return next()
    if (pathname.includes('/node_modules/')) return next()

    if (isSpaPath(pathname)) {
      // Mirror Vercel's cleanUrls: a prerendered per-route HTML (dist/Shop.html)
      // is preferred over the shared shell, so the raw head is correct per URL.
      const prerendered = resolve(outDir, `${pathname.replace(/^\/+/, "")}.html`)
      if (prerendered.startsWith(outDir + '/')) {
        try {
          if (statSync(prerendered).isFile()) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(readFileSync(prerendered))
            return
          }
        } catch {
          /* fall through to the shared shell */
        }
      }
      return next()
    }

    const rel = pathname.replace(/^\/+/, '')
    const bases = [publicDir, outDir, root].filter(Boolean)
    const isFile = bases.some((base) => {
      let target
      try {
        target = resolve(base, rel)
      } catch {
        return false
      }
      // Never allow a request to climb out of the served directory.
      if (target !== base && !target.startsWith(base + '/')) return false
      try {
        return statSync(target).isFile()
      } catch {
        return false
      }
    })

    if (isFile) return next()

    res.statusCode = 404
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(NOT_FOUND_HTML)
  }

  const withConfig = (server) => {
    const cfg = server.config
    return middleware(cfg.root, cfg.publicDir, resolve(cfg.root, cfg.build?.outDir || 'dist'))
  }

  return {
    name: 'collegecart-spa-404',
    configureServer(server) {
      server.middlewares.use(withConfig(server))
    },
    configurePreviewServer(server) {
      server.middlewares.use(withConfig(server))
    },
  }
}

export default defineConfig({
  logLevel: 'info',
  plugins: [
    react({
      // Enable Fast Refresh for better DX
      fastRefresh: true,
      // Optimize JSX runtime
      jsxRuntime: 'automatic',
    }),
    spaNotFound(),
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
