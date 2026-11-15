/**
 * =============================================================================
 * DÉCONNEXION AUTOMATIQUE APRÈS INACTIVITÉ (cahier des charges §7)
 * =============================================================================
 * Délai : paramètre général « Déconnexion après inactivité (minutes) »
 * (SESSION_EXPIRATION_MINUTES, renvoyé par GET /api/auth/moi ; 0 = désactivé).
 *
 *   - Toute action (souris, clavier, clic, défilement, toucher) remet le
 *     compteur à zéro. L'heure de la dernière action est partagée entre les
 *     ONGLETS ouverts (localStorage) : travailler dans un onglet garde les
 *     autres connectés.
 *   - 1 minute avant la fin : alerte avec compte à rebours,
 *     « Rester connecté » ou « Se déconnecter ».
 *   - À la fin : déconnexion et retour à l'écran de connexion (avec message).
 *   - Déconnexion dans un onglet = déconnexion de tous les onglets.
 *
 * Utilisation (dans le gabarit principal, une seule fois) :
 *     import { utiliserDeconnexionAuto } from '@/utils/deconnexionAuto'
 *     utiliserDeconnexionAuto()
 * =============================================================================
 */
import { onBeforeUnmount, onMounted } from 'vue'
import Swal from 'sweetalert2'
import store from '@/store'
import router from '@/router'

const CLE_ACTIVITE = 'sd_derniere_activite'
const CLE_JETON = 'sd_token' // même clé que store/modules/auth.js
const PREAVIS_MS = 60 * 1000 // alerte 1 minute avant
const EVENEMENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']

export function utiliserDeconnexionAuto() {
  let minuterie = null
  let alerteOuverte = false
  let derniereEcriture = 0

  /** Délai en millisecondes (0 = pas de déconnexion automatique). */
  const delai = () => Math.max(0, Number(store.state.auth.user?.delaiInactivite ?? 30)) * 60 * 1000

  /** Note une activité (au plus une écriture toutes les 5 s pour ne pas surcharger). */
  function activite() {
    const maintenant = Date.now()
    if (alerteOuverte || maintenant - derniereEcriture < 5000) return
    derniereEcriture = maintenant
    localStorage.setItem(CLE_ACTIVITE, String(maintenant))
  }

  function derniereActivite() {
    return Number(localStorage.getItem(CLE_ACTIVITE)) || Date.now()
  }

  /** Déconnexion + écran de connexion avec un message. */
  function deconnecter(raison) {
    arreter()
    Swal.close()
    store.dispatch('auth/logout')
    router.push({ name: 'login', query: raison ? { raison } : {} })
  }

  /** Alerte « vous allez être déconnecté » avec compte à rebours. */
  async function prevenir() {
    alerteOuverte = true
    let intervalle = null
    const resultat = await Swal.fire({
      title: 'Session sur le point d\'expirer',
      html: 'Sans action de votre part, vous serez déconnecté dans <strong id="compte-a-rebours">60</strong> secondes.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Rester connecté',
      cancelButtonText: 'Se déconnecter',
      confirmButtonColor: '#00a36c',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
      allowOutsideClick: false,
      didOpen: () => {
        intervalle = setInterval(() => {
          const reste = Math.max(0, Math.ceil((derniereActivite() + delai() - Date.now()) / 1000))
          const zone = document.getElementById('compte-a-rebours')
          if (zone) zone.textContent = String(reste)
          // Activité dans un autre onglet : l'alerte se ferme d'elle-même
          if (reste > PREAVIS_MS / 1000) Swal.close()
        }, 1000)
      },
      willClose: () => clearInterval(intervalle),
    })
    alerteOuverte = false
    if (resultat.isConfirmed) {
      derniereEcriture = 0
      activite()
    } else if (resultat.dismiss === Swal.DismissReason.cancel) {
      deconnecter()
    }
  }

  /** Vérification toutes les 5 secondes. */
  function verifier() {
    if (!store.getters['auth/isAuthenticated'] || delai() === 0) return
    const inactif = Date.now() - derniereActivite()
    if (inactif >= delai()) deconnecter('inactivite')
    else if (inactif >= delai() - PREAVIS_MS && !alerteOuverte) prevenir()
  }

  /** Autre onglet : déconnexion (jeton supprimé) -> on suit. */
  function surStockage(evenement) {
    if (evenement.key === CLE_JETON && !evenement.newValue && store.state.auth.token) {
      arreter()
      Swal.close()
      store.commit('auth/CLEAR_SESSION')
      router.push({ name: 'login' })
    }
  }

  function arreter() {
    clearInterval(minuterie)
    minuterie = null
    EVENEMENTS.forEach((e) => window.removeEventListener(e, activite))
    window.removeEventListener('storage', surStockage)
  }

  onMounted(() => {
    derniereEcriture = 0
    localStorage.setItem(CLE_ACTIVITE, String(Date.now()))
    EVENEMENTS.forEach((e) => window.addEventListener(e, activite, { passive: true }))
    window.addEventListener('storage', surStockage)
    minuterie = setInterval(verifier, 5000)
  })
  onBeforeUnmount(arreter)
}
