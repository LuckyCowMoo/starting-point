import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['pptxgenjs', 'jszip', 'idb-keyval', 'lucide-react'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
