import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.BACKEND_PROXY_TARGET || 'http://127.0.0.1:5000';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: ['3000-irmm05gg7vy1q3xf12hjw-8946cd1a.sg2.manus.computer'],
      proxy: {
        '/api': { target: backend, changeOrigin: false },
        '/uploads': { target: backend, changeOrigin: false },
      },
    },
  };
});
