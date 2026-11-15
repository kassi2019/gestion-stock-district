/**
 * =============================================================================
 * STORE VUEX : données partagées entre les écrans
 * =============================================================================
 * Le "store" est un espace mémoire commun à toute l'application.
 * On y range les données dont plusieurs écrans ont besoin
 * (ex. l'utilisateur connecté, la liste des centres).
 *
 * Il est découpé en "modules" (un fichier par sujet, dans le dossier modules/).
 *
 * ➜ Pour ajouter un module (ex. stock) :
 *     1. créer le fichier modules/stock.js (copier la structure de auth.js) ;
 *     2. l'importer ici et l'ajouter dans "modules".
 * =============================================================================
 */
import { createStore } from 'vuex'
import auth from './modules/auth'
import notifications from './modules/notifications'
import referentiel from './modules/referentiel'

export default createStore({
  // En développement, Vuex signale toute modification faite hors d'une "mutation"
  strict: import.meta.env.DEV,

  modules: {
    auth, // utilisateur connecté et jeton de connexion
    notifications, // messages de succès / d'erreur en bas à droite
    referentiel, // centres, fournisseurs, familles, médicaments (01 Paramétrage)
  },
})
