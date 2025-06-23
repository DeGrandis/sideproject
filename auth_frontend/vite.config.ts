import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'; // Still needed for path.resolve if used elsewhere
import tsconfigPaths from 'vite-tsconfig-paths';

// Remove or comment out this section if vite-tsconfig-paths is handling the alias
const resolvedPath = path.resolve(__dirname, process.env.SHARED_PACKAGES_PATH || '../shared-packages/');
console.log('Resolved @shared path:', resolvedPath);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({jsxRuntime: 'automatic'}), tsconfigPaths()],
  server: {
    host: true, // or '0.0.0.0' to listen on all addresses
  },

  resolve: {
    preserveSymlinks: true
  },

  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: ["../shared-packages/", "/node_modules/"], // Ensure paths are correct
    },
  }
})
