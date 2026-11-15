/**
 * =============================================================================
 * DROITS PAR MODULE (côté écran)
 * =============================================================================
 * Chaque profil a, pour chaque module, TROIS droits indépendants :
 *   - VOIR      : le module apparaît (tuile, page), on peut consulter ;
 *   - IMPRIMER  : boutons « PDF » visibles ;
 *   - MODIFIER  : boutons Nouveau, Modifier, Importer, Désactiver... visibles.
 *   (Sans aucun droit, le module n'apparaît pas.)
 * Les droits viennent du serveur (connexion et /auth/moi) et sont gérés dans
 * Utilisateurs > Profils & droits. L'ADMIN a toujours tout.
 *
 * Dans un écran :
 *     store.getters['auth/peutVoir']('stock')           -> true / false
 *     store.getters['auth/peutImprimer']('stock')       -> true / false
 *     store.getters['auth/peutModifier']('parametrage') -> true / false
 *
 * Sur un bouton qui MODIFIE des données (Nouveau, Modifier, Importer...) :
 *     <button v-si-modif @click="...">+ Nouveau</button>
 *   -> CACHÉ si le profil n'a pas le droit MODIFIER sur le module de la page
 *      en cours. (Le serveur refuse de toute façon la modification.)
 * Sur un bouton d'IMPRESSION (PDF) :
 *     <button v-si-imprimer @click="...">PDF</button>
 *   -> CACHÉ si le profil n'a pas le droit IMPRIMER.
 *   Variante pour un autre module :  v-si-modif="'stock'"   v-si-imprimer="'stock'"
 * =============================================================================
 */
import store from '@/store'
import router from '@/router'

/** Les trois droits (mêmes valeurs que le backend). */
export const DROITS = {
  VOIR: 'VOIR',
  IMPRIMER: 'IMPRIMER',
  MODIFIER: 'MODIFIER',
}

/** Module de la page affichée (ex. 'parametrage'), ou null sur l'accueil. */
function moduleCourant() {
  return router.currentRoute.value.meta?.module?.code || null
}

/**
 * Crée une directive qui affiche ou cache l'élément selon un droit.
 * @param getter 'auth/peutModifier' ou 'auth/peutImprimer'
 */
function directiveDeDroit(getter) {
  const appliquer = (el, binding) => {
    const module = binding.value || moduleCourant()
    const autorise = !module || store.getters[getter](module)
    el.style.display = autorise ? '' : 'none'
  }
  return { mounted: appliquer, updated: appliquer }
}

/** Directive v-si-modif : bouton visible seulement avec le droit MODIFIER. */
export const siModif = directiveDeDroit('auth/peutModifier')

/** Directive v-si-imprimer : bouton visible seulement avec le droit IMPRIMER. */
export const siImprimer = directiveDeDroit('auth/peutImprimer')
