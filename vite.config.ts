import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const browser = env.VITE_BROWSER || 'chrome';
  const outDir = `dist-${browser}`;

  return {
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: `src/manifest.${browser}.json`,
            dest: '.',
            rename: 'manifest.json',
          },
          { src: 'src/icons', dest: '.' },
          { src: 'src/styles', dest: '.' },
        ],
      }),
    ],
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background.ts'),
          content: resolve(__dirname, 'src/content.ts'),
          popup: resolve(__dirname, 'src/popup.html'),
          options: resolve(__dirname, 'src/options.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          format: 'es',
        },
      },
      target: 'es2020',
      minify: false,
    },
    resolve: {
      alias: {
        'webextension-polyfill': resolve(__dirname, 'node_modules/webextension-polyfill/dist/browser-polyfill.js'),
      },
    },
  };
});