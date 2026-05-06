import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    solidPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
        '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
        '/member': {target: 'http://127.0.0.1:8000', changeOrigin: true }
    },
    historyApiFallback: true,
  },
});