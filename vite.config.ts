import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // Set the project root to 'src' to ensure a flat output directory
  root: 'src',
  // Set the base to be relative, which is crucial for browser extensions
  base: './',

  plugins: [
    viteStaticCopy({
      targets: [
        // These files are inside `src`, so paths are relative to the `root`
        { src: 'manifest.json', dest: '.' },
        { src: 'icons', dest: '.' },
        { src: 'styles', dest: '.' },
        // For node_modules, we go up one level from `src`
        { src: '../node_modules/katex/dist/katex.min.css', dest: 'styles' },
        { src: '../node_modules/katex/dist/fonts', dest: 'styles/fonts' },
      ],
    }),
  ],

  build: {
    // Output to '../dist' relative to the `src` root
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      // Use absolute paths for Rollup's input to avoid ambiguity
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
});