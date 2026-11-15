/**
 * =============================================================================
 * CONFIGURATION DE VITE (outil qui lance et compile le frontend)
 * =============================================================================
 * Commandes :
 *   npm run dev    -> lance le frontend en développement (http://localhost:5173)
 *   npm run build  -> crée la version finale dans le dossier dist/
 * =============================================================================
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    // Raccourci : "@/..." désigne le dossier src/
    // Exemple : import http from '@/api/http'
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  server: {
    port: 5173,
    // true = le frontend est accessible depuis les autres postes du réseau local
    host: true,
    // Les appels vers /api sont transmis au backend NestJS (port 3000 par défaut).
    // Ainsi le frontend et l'API semblent être à la même adresse.
    // Pour viser un autre backend : variable d'environnement API_CIBLE
    // (ex. API_CIBLE=http://192.168.1.10:3000 npm run dev)
    proxy: {
      '/api': { target: process.env.API_CIBLE || 'http://localhost:3000', changeOrigin: true },
    },
  },
})
