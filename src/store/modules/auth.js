/**
 * =============================================================================
 * MODULE VUEX "auth" : utilisateur connecté
 * =============================================================================
 * Un module Vuex contient toujours 4 parties :
 *   - state     : les données (ici : le jeton et l'utilisateur) ;
 *   - getters   : des calculs à partir des données (ex. "est-il connecté ?") ;
 *   - mutations : les SEULES fonctions qui ont le droit de modifier le state ;
 *   - actions   : les traitements (appels API...) qui appellent ensuite les mutations.
 *
 * Utilisation dans un écran :
 *     store.state.auth.user                    -> l'utilisateur connecté
 *     store.getters['auth/isAuthenticated']    -> true / false
 *     store.dispatch('auth/login', {...})      -> lancer la connexion
 *
 * La session est aussi sauvegardée dans le navigateur (localStorage) pour que
 * l'utilisateur reste connecté s'il actualise la page.
 * =============================================================================
 */
import http from '@/api/http'

// Noms des clés utilisées dans le stockage du navigateur
const CLE_JETON = 'sd_token'
const CLE_UTILISATEUR = 'sd_user'

/**
 * Droits d'un module tels que reçus du serveur -> liste.
 * Accepte aussi l'ancien format ('LECTURE' = voir + imprimer ;
 * 'MODIFICATION' = les trois), le temps que la session soit relue.
 */
function lireDroits(valeur) {
  if (Array.isArray(valeur)) return valeur
  if (valeur === 'LECTURE') return ['VOIR', 'IMPRIMER']
  if (valeur === 'MODIFICATION') return ['VOIR', 'IMPRIMER', 'MODIFIER']
  return []
}

export default {
  namespaced: true, // les noms sont préfixés par "auth/"

  // ---------------------------------------------------------------------------
  // STATE : données (relues depuis le navigateur au chargement de la page)
  // ---------------------------------------------------------------------------
  state: () => ({
    token: localStorage.getItem(CLE_JETON),
    user: JSON.parse(localStorage.getItem(CLE_UTILISATEUR) || 'null'),
  }),

  // ---------------------------------------------------------------------------
  // GETTERS : informations calculées
  // ---------------------------------------------------------------------------
  getters: {
    /** Vrai si un utilisateur est connecté. */
    isAuthenticated(state) {
      return !!state.token
    },

    /** Code du profil de l'utilisateur (ADMIN, COMPTABLE, ...). */
    role(state) {
      return state.user ? state.user.role : null
    },

    /**
     * Vérifie si l'utilisateur a l'un des profils donnés.
     * L'administrateur a toujours accès.
     * Exemple : store.getters['auth/hasRole']('COMPTABLE', 'RESPONSABLE_DISTRICT')
     */
    hasRole(state) {
      return (...profils) => {
        if (!state.user) return false
        if (state.user.role === 'ADMIN') return true
        return profils.includes(state.user.role)
      }
    },

    /**
     * Droits sur un module : liste parmi 'VOIR', 'IMPRIMER', 'MODIFIER'
     * ([] = aucun accès). L'administrateur a toujours les trois.
     * (Voir src/utils/droits.js)
     */
    droits(state) {
      return (module) => {
        if (!state.user) return []
        if (state.user.role === 'ADMIN') return ['VOIR', 'IMPRIMER', 'MODIFIER']
        return lireDroits(state.user.permissions?.[module])
      }
    },

    /** Vrai si l'utilisateur peut OUVRIR le module (droit VOIR). */
    peutVoir(_state, getters) {
      return (module) => getters.droits(module).includes('VOIR')
    },

    /** Vrai si l'utilisateur peut IMPRIMER / télécharger les PDF du module. */
    peutImprimer(_state, getters) {
      return (module) => getters.droits(module).includes('IMPRIMER')
    },

    /** Vrai si l'utilisateur peut MODIFIER dans le module. */
    peutModifier(_state, getters) {
      return (module) => getters.droits(module).includes('MODIFIER')
    },
  },

  // ---------------------------------------------------------------------------
  // MUTATIONS : modifications du state
  // ---------------------------------------------------------------------------
  mutations: {
    /** Enregistre la session après une connexion réussie. */
    SET_SESSION(state, { token, user }) {
      state.token = token
      state.user = user
      localStorage.setItem(CLE_JETON, token)
      localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(user))
    },

    /** Efface la session (déconnexion). */
    CLEAR_SESSION(state) {
      state.token = null
      state.user = null
      localStorage.removeItem(CLE_JETON)
      localStorage.removeItem(CLE_UTILISATEUR)
    },
  },

  // ---------------------------------------------------------------------------
  // ACTIONS : traitements
  // ---------------------------------------------------------------------------
  actions: {
    /**
     * Connexion : envoie l'identifiant et le mot de passe au backend.
     * En cas d'erreur (mauvais mot de passe...), l'erreur est renvoyée à l'écran.
     */
    async login({ commit }, { login, motDePasse }) {
      const reponse = await http.post('/auth/login', { login, motDePasse })
      commit('SET_SESSION', {
        token: reponse.data.accessToken,
        user: reponse.data.utilisateur,
      })
      return reponse.data.utilisateur
    },

    /**
     * Relit l'utilisateur connecté auprès du serveur (nom, profil, DROITS).
     * Appelée à l'ouverture de l'application : un changement de droits fait
     * par l'administrateur est ainsi pris en compte sans se reconnecter.
     */
    async rafraichir({ commit, state }) {
      if (!state.token) return
      const reponse = await http.get('/auth/moi')
      // Déconnexion pendant l'appel : on ne réenregistre pas l'utilisateur
      if (!state.token) return
      commit('SET_SESSION', { token: state.token, user: { ...state.user, ...reponse.data } })
    },

    /** Déconnexion. */
    logout({ commit }) {
      commit('CLEAR_SESSION')
    },
  },
}
