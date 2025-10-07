import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const browser = env.VITE_BROWSER || 'chrome';
  const outDir = `../dist-${browser}`; // Adjusted for the new root

  return {
    root: 'src', // Set the project root to the 'src' directory
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: `manifest.${browser}.json`, // Path is now relative to 'src'
            dest: '.',
            rename: 'manifest.json',
          },
          { src: 'icons', dest: '.' },     // Path is now relative to 'src'
          { src: 'styles', dest: '.' },   // Path is now relative to 'src'
        ],
      }),
    ],
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          // Paths should be relative to the new root 'src'
          background: resolve(__dirname, 'src/background.ts'),
          content: resolve(__dirname, 'src/content.ts'),
          popup: resolve(__dirname, 'src/popup.html'),
          options: resolve(__dirname, 'src/options.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]', // This should now work correctly
          format: 'es',
        },
      },
      target: 'es2020',
      minify: false,
    },
    resolve: {
      alias: {
        // The alias path needs to resolve correctly from the new root
        'webextension-polyfill': resolve(__dirname, 'node_modules/webextension-polyfill/dist/browser-polyfill.js'),
      },
    },
  };
});