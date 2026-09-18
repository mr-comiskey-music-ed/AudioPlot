import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(() => {
  return {
    // Relative base ensures internal references resolve cleanly
    base: './',
    plugins: [react(), tailwindcss(), viteSingleFile()],
    build: {
      // Inlines imported MP3 stems up to 5MB as Base64 data strings
      assetsInlineLimit: 5000000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Retained for Google AI Studio environment stability
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
