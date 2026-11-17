import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Keep browser requests on the React origin while Express serves the API.
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } },
  },
});
