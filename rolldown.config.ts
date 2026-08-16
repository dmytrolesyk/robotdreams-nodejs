import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/index.ts',
  platform: 'node',
  output: {
    format: 'esm',
    file: 'dist/index.js',
    minify: true,
    sourcemap: true,
  },
});
