import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',

  plugins: [
    react(),
  ],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    // Keep CSS in one file — prevents async CSS loading race conditions on Vercel CDN
    cssCodeSplit: false,
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@supabase'))                       return 'supabase';
          if (id.includes('framer-motion'))                  return 'framer';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('@radix-ui'))                      return 'radix';
          if (id.includes('lucide-react'))                   return 'icons';
          if (id.includes('date-fns'))                       return 'datefns';
          return 'vendor';
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

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

  server: {
    headers: {
      'Cache-Control': 'no-cache',
    },
  },
});