import { defineConfig } from 'vite';

// Relative asset paths are required for Electron's offline file:// URL.
export default defineConfig({base:'./'});
