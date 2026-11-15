/**
 * =============================================================================
 * POINT D'ENTRÉE DU FRONTEND
 * =============================================================================
 * Crée l'application Vue, branche le store (Vuex) et le routeur,
 * puis l'affiche dans la balise <div id="app"> du fichier index.html.
 * =============================================================================
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './style.css' // styles communs à toute l'application
import { siImprimer, siModif } from './utils/droits'

createApp(App)
  .use(store) // données partagées (utilisateur connecté, ...)
  .use(router) // navigation entre les pages
  // v-si-modif / v-si-imprimer : cachent un bouton selon les droits du profil (voir utils/droits.js)
  .directive('si-modif', siModif)
  .directive('si-imprimer', siImprimer)
  .mount('#app')
