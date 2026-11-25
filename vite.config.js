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
        adminLogin: resolve(import.meta.dirname, 'admin-login.html'),
        forgotPassword: resolve(import.meta.dirname, 'forgot-password.html'),
        register: resolve(import.meta.dirname, 'register.html'),
        tailorApplication: resolve(import.meta.dirname, 'become-tailor.html'),
        help: resolve(import.meta.dirname, 'help.html'),
        customerDashboard: resolve(import.meta.dirname, 'customer-dashboard.html'),
        adminDashboard: resolve(import.meta.dirname, 'admin-dashboard.html'),
        tailorDashboard: resolve(import.meta.dirname, 'tailor-dashboard.html'),
      },
    },
  },
});
