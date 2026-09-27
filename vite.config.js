import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin'


export default defineConfig({
  // Relative base so the build works on itch.io or any subfolder host
  base: './',
  server: { port: 8080, open: true },
  build: {
    chunkSizeWarningLimit: 2000, // Phaser is big; silence the warning
  },
  plugins: [cloudflare()],
});
