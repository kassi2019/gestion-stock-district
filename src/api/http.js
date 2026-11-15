/**
 * =============================================================================
 * CLIENT HTTP : communication avec l'API (backend)
 * =============================================================================
 * Tous les appels au backend passent par cet objet "http" (basé sur axios).
 *
 * Exemple d'utilisation :
 *     import http from '@/api/http'
 *     const reponse = await http.get('/centres')       // lire
 *     await http.post('/centres', { nom: 'CSU Abobo' }) // créer
 *
 * Ce fichier ajoute deux comportements automatiques :
 *   1. AVANT chaque requête : ajoute le jeton de connexion dans l'en-tête ;
 *   2. APRÈS chaque réponse : si le backend répond 401 (session expirée ou
 *      invalide), l'utilisateur est déconnecté et renvoyé vers la connexion.
 * =============================================================================
 */
import axios from 'axios'
import store from '@/store'
import router from '@/router'

const http = axios.create({
  // Adresse de l'API, définie dans le fichier .env (VITE_API_URL=/api)
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Délai maximum d'attente d'une réponse : 30 secondes
  timeout: 30000,
})

// 1. Avant chaque requête : on ajoute le jeton de connexion s'il existe
http.interceptors.request.use((config) => {
  const jeton = store.state.auth.token
  if (jeton) {
    config.headers.Authorization = `Bearer ${jeton}`
  }
  return config
})

// 2. Après chaque réponse : gestion de la session expirée
http.interceptors.response.use(
  // Réponse OK : on la renvoie telle quelle
  (reponse) => reponse,

  // Réponse en erreur
  (erreur) => {
    const sessionInvalide = erreur.response && erreur.response.status === 401
    if (sessionInvalide) {
      store.dispatch('auth/logout')
      if (router.currentRoute.value.name !== 'login') {
        router.push({ name: 'login' })
      }
    }
    // On transmet l'erreur à l'écran qui a fait l'appel (pour afficher un message)
    return Promise.reject(erreur)
  },
)

export default http
