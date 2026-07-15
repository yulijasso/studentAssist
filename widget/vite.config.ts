import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      outDir: 'dist/types',
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'CampusAssistWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      // No external deps — everything must be bundled.
      external: [],
    },
    reportCompressedSize: true,
    // Target modern browsers — keeps bundle small.
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
  },
});
