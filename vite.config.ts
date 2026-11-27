import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Dependências opcionais do jsPDF que o app não usa (ver src/report/jspdfOptionalStub.ts).
const stub = fileURLToPath(new URL('./src/report/jspdfOptionalStub.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  // Verdadeiro só nos testes (Node, sem DOM): ver markup() em src/platform/widgets.ts.
  define: { __NODE_RENDER__: JSON.stringify(!!process.env.VITEST) },
  resolve: { alias: { html2canvas: stub, dompurify: stub, canvg: stub } },
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
