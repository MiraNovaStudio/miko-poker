import { defineConfig } from 'vite';
import path from 'path';
import { readFileSync } from 'fs';
import javascriptObfuscator from 'vite-plugin-javascript-obfuscator';

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'));

export default defineConfig(({ mode }) => ({
  publicDir: 'static',
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../engine/dist'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // no sourcemaps in production — defeats obfuscation
  },
  server: {
    port: 3000,
    open: true,
  },
  plugins: mode === 'production' ? [
    javascriptObfuscator({
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.5,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.2,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: false,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.5,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
      },
    }),
  ] : [],
}));
