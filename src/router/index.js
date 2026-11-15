/**
 * =============================================================================
 * ROUTEUR : liste des pages de l'application
 * =============================================================================
 * Chaque "route" associe une adresse (ex. /achats) à un écran (fichier .vue).
 *
 * Les pages des modules sont créées AUTOMATIQUEMENT à partir de la liste
 * src/config/modules.js : il n'y a rien à ajouter ici pour un nouveau module.
 *
 * Options utiles dans "meta" :
 *   - public: true          -> page accessible sans être connecté
 *   - roles: ['COMPTABLE']  -> page réservée à certains profils (+ ADMIN)
 * =============================================================================
 */
import { createRouter, createWebHistory } from 'vue-router'
import store from '@/store'
import { MODULES } from '@/config/modules'

/**
 * Une route par module de src/config/modules.js.
 * Si le module n'a pas encore d'écran ("vue" absente), on affiche la page
 * "module en cours de développement".
 */
const routesDesModules = MODULES.map((module) => ({
  path: module.code,
  name: module.code,
  component: module.vue || (() => import('@/views/ModuleEnConstructionView.vue')),
  meta: { titre: module.titre, module },
}))

const routes = [
  // Page de connexion (seule page publique)
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },

  // Pages de l'application : affichées à l'intérieur de la mise en page
  // principale (menu à gauche + barre du haut)
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { titre: 'Accueil' },
      },
      ...routesDesModules,
    ],
  },

  // Adresse inconnue : retour à l'accueil
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * Contrôle exécuté avant chaque changement de page.
 * Retourner une route = rediriger ; ne rien retourner = autoriser.
 */
router.beforeEach((pageDemandee) => {
  const estConnecte = store.getters['auth/isAuthenticated']

  // Page protégée et utilisateur non connecté -> page de connexion
  // (on garde l'adresse demandée pour y revenir après la connexion)
  if (!pageDemandee.meta.public && !estConnecte) {
    return { name: 'login', query: { redirect: pageDemandee.fullPath } }
  }

  // Déjà connecté et va sur la page de connexion -> accueil
  if (pageDemandee.name === 'login' && estConnecte) {
    return { name: 'dashboard' }
  }

  // Page d'un module : il faut au moins la LECTURE sur ce module (voir utils/droits.js)
  const module = pageDemandee.meta.module
  if (module && !store.getters['auth/peutVoir'](module.code)) {
    return { name: 'dashboard' }
  }
})

export default router
