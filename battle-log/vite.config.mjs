import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'public/build',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/parties.jsx', import.meta.url)),
      output: { entryFileNames: 'parties.js', chunkFileNames: '[name]-[hash].js' }
    }
  }
});
