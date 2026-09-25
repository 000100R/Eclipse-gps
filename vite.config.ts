import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';
import dotenv from 'dotenv';

dotenv.config();

// Ensure variables from /app/.dev.env.json are loaded into process.env if present
try {
  if (fs.existsSync('/app/.dev.env.json')) {
    const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
    for (const [k, v] of Object.entries(devEnv)) {
      if (!process.env[k] && typeof v === 'string') {
        process.env[k] = v;
      }
    }
  }
} catch (e) {}

const cleanEnvVar = (val: string | undefined): string => {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
};

export default defineConfig(() => {
  // Only expose client-safe VITE_ prefixed environment variables into the frontend bundle
  const mapsApiKey = cleanEnvVar(process.env.VITE_GOOGLE_MAPS_API_KEY);
  const mapsMapId = cleanEnvVar(process.env.VITE_GOOGLE_MAPS_MAP_ID);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(mapsApiKey),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY_ANDROID': JSON.stringify(cleanEnvVar(process.env.VITE_GOOGLE_MAPS_API_KEY_ANDROID) || mapsApiKey),
      'import.meta.env.VITE_GOOGLE_MAPS_MAP_ID': JSON.stringify(mapsMapId),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-motion': ['motion'],
            'vendor-leaflet': ['leaflet'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
  };
});
