import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  plugins: [react()],   // removed kimi-plugin-inspect-react (dev-only, adds overhead)

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Manual chunk splitting — heavy libs in their own cacheable files
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Supabase client — large, changes rarely
            if (id.includes('@supabase')) return 'supabase';
            // Framer Motion — large, used everywhere
            if (id.includes('framer-motion')) return 'framer';
            // Recharts + D3 — admin-only, load separately
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            // Radix UI primitives — big collection
            if (id.includes('@radix-ui')) return 'radix';
            // Lucide icons
            if (id.includes('lucide-react')) return 'icons';
            // Date-fns
            if (id.includes('date-fns')) return 'datefns';
            // Everything else in vendor
            return 'vendor';
          }
        },
        // Deterministic filenames for long-term caching
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },
  },

  // Pre-bundle commonly used deps for faster dev cold start
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      '@supabase/supabase-js',
      'lucide-react',
      'sonner',
      'date-fns',
    ],
  },
});