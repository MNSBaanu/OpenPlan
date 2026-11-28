import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { swVersion } from './scripts/sw-version.mjs';

export default defineConfig({
  base: './',
  plugins: [react(), swVersion()]
});
