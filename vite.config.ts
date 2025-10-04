import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'fs';
import path from 'path';

// Custom plugin to move HTML files to the root
function moveHtmlFiles() {
  return {
    name: 'move-html-files',
    writeBundle() {
      // Move popup.html from dist/src/ to dist/
      const srcPopup = path.join(__dirname, 'dist/src/popup.html');
      const destPopup = path.join(__dirname, 'dist/popup.html');
      if (fs.existsSync(srcPopup)) {
        fs.copyFileSync(srcPopup, destPopup);
        fs.unlinkSync(srcPopup);
      }

      // Move options.html from dist/src/ to dist/
      const srcOptions = path.join(__dirname, 'dist/src/options.html');
      const destOptions = path.join(__dirname, 'dist/options.html');
      if (fs.existsSync(srcOptions)) {
        fs.copyFileSync(srcOptions, destOptions);
        fs.unlinkSync(srcOptions);
      }

      // Remove empty src directory
      const srcDir = path.join(__dirname, 'dist/src');
      if (fs.existsSync(srcDir) && fs.readdirSync(srcDir).length === 0) {
        fs.rmdirSync(srcDir);
      }
    }
  };
}

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'src/manifest.json', dest: '.' },
        { src: 'src/icons', dest: '.' }
      ]
    }),
    moveHtmlFiles()
  ],
  build: {
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
        // Remove the format option - it's causing the error
      },
    },
    outDir: 'dist',
    copyPublicDir: false,
    // Add this to handle the background script properly
    target: 'es2020',
    minify: false,
  },
});