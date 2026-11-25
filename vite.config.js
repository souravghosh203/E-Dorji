import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        root: resolve(import.meta.dirname, 'index.html'),
        home: resolve(import.meta.dirname, 'e-dorji.html'),
        about: resolve(import.meta.dirname, 'about.html'),
        login: resolve(import.meta.dirname, 'login.html'),
        register: resolve(import.meta.dirname, 'register.html'),
        tailorApplication: resolve(import.meta.dirname, 'become-tailor.html'),
      },
    },
  },
});
