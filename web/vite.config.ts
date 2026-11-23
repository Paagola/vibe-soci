import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// La interfaz del chat. En desarrollo (npm run web:dev) la API va al servidor del estudio (npm run estudio).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:4321', '/archivos': 'http://127.0.0.1:4321' } },
  build: { outDir: 'dist', emptyOutDir: true },
});
