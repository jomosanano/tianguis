
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Aumentamos el límite a 1000kb para reducir advertencias innecesarias
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Separamos las librerías grandes en archivos independientes para mejor caché y carga
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('jsqr')) return 'scanner';
            if (id.includes('lucide-react')) return 'icons';
            return 'vendor';
          }
        }
      }
    }
  }
});
