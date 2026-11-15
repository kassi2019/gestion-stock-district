/**
 * =============================================================================
 * ALERTES ET NOTIFICATIONS (SweetAlert2)
 * =============================================================================
 * Toutes les fenêtres de confirmation et les notifications de l'application
 * passent par ce fichier, pour avoir partout le même style (vert santé).
 *
 * 1) NOTIFICATION (petit message en HAUT À DROITE, disparaît tout seul) :
 *
 *      import { notifier } from '@/utils/alertes'
 *      notifier('succes', 'Centre enregistré.')
 *      notifier('erreur', 'Impossible d\'enregistrer.')
 *
 *    (Dans les écrans, on utilise plutôt le store :
 *       store.dispatch('notifications/succes', '...')
 *     qui appelle cette fonction.)
 *
 * 2) CONFIRMATION (fenêtre au centre avec boutons Oui / Annuler) :
 *
 *      import { confirmer } from '@/utils/alertes'
 *      if (!(await confirmer({
 *        titre: 'Désactiver ce centre ?',
 *        texte: 'Il n\'apparaîtra plus dans les listes de saisie.',
 *        boutonConfirmer: 'Oui, désactiver',
 *        danger: true,              // bouton rouge pour les actions sensibles
 *      }))) return
 *
 * Documentation SweetAlert2 : https://sweetalert2.github.io
 * =============================================================================
 */
import Swal from 'sweetalert2'

// Couleurs de l'application (les mêmes que dans src/style.css)
const VERT = '#00a36c'
const ROUGE = '#b91c1c'
const GRIS = '#6b7280'

/**
 * Modèle de notification : en haut à droite, sans bouton,
 * disparaît après 3,5 secondes (la barre de progression montre le temps restant).
 * Passer la souris dessus met le minuteur en pause.
 */
const Notification = Swal.mixin({
  toast: true,
  position: 'top-end', // en haut à droite
  showConfirmButton: false,
  showCloseButton: true,
  timer: 3500,
  timerProgressBar: true,
  customClass: { popup: 'notification-swal' },
  didOpen: (fenetre) => {
    fenetre.addEventListener('mouseenter', Swal.stopTimer)
    fenetre.addEventListener('mouseleave', Swal.resumeTimer)
  },
})

/**
 * Affiche une notification en haut à droite.
 * @param type  'succes' | 'erreur' | 'info' | 'attention'
 * @param texte message à afficher
 */
export function notifier(type, texte) {
  const icones = { succes: 'success', erreur: 'error', info: 'info', attention: 'warning' }
  Notification.fire({ icon: icones[type] || 'info', title: texte })
}

/**
 * Fenêtre de confirmation. Renvoie true si l'utilisateur confirme, false sinon.
 * @param titre           question principale (ex. 'Supprimer cette famille ?')
 * @param texte           explication (facultatif)
 * @param boutonConfirmer texte du bouton de confirmation (par défaut 'Oui, confirmer')
 * @param danger          true = bouton rouge et icône d'avertissement
 */
export async function confirmer({ titre, texte = '', boutonConfirmer = 'Oui, confirmer', danger = false }) {
  const resultat = await Swal.fire({
    title: titre,
    text: texte,
    icon: danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: boutonConfirmer,
    cancelButtonText: 'Annuler',
    confirmButtonColor: danger ? ROUGE : VERT,
    cancelButtonColor: GRIS,
    reverseButtons: true, // "Annuler" à gauche, confirmation à droite
    focusCancel: danger, // pour une action sensible, "Annuler" est sélectionné par défaut
    // Comme pour les formulaires : on ne ferme pas en cliquant à côté
    allowOutsideClick: false,
  })
  return resultat.isConfirmed
}
