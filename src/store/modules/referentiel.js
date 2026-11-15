/**
 * =============================================================================
 * MODULE VUEX "referentiel" : données de référence (module 01 Paramétrage)
 * =============================================================================
 * Contient les listes utilisées dans toute l'application :
 *   - typesCentre   (types de centres : CSU, CSR, Dispensaire...)
 *   - centres       (centres de santé)
 *   - fournisseurs
 *   - familles      (familles de médicaments)
 *   - formes        (formes de médicaments : comprimé, sirop...)
 *   - unitesVente   (unités de vente : boîte, plaque, flacon...)
 *   - fonctions     (fonctions du personnel : pharmacien, caissière...)
 *   - medicaments   (catalogue)
 *
 * Ces 8 listes fonctionnent toutes de la même façon, d'où des actions
 * "génériques" qui reçoivent le NOM de la liste :
 *
 *     store.dispatch('referentiel/charger', { liste: 'centres' })
 *     store.dispatch('referentiel/charger', { liste: 'medicaments', filtres: { recherche: 'para' } })
 *     store.dispatch('referentiel/enregistrer', { liste: 'centres', element: {...} })
 *     store.dispatch('referentiel/changerActif', { liste: 'centres', element, actif: false })
 *
 *     store.state.referentiel.centres   -> la liste chargée
 *
 * "enregistrer" fait une CRÉATION si l'élément n'a pas d'id, sinon une MODIFICATION.
 * =============================================================================
 */
import http from '@/api/http'

/** Adresse de l'API pour chaque liste. */
const ADRESSES = {
  typesCentre: '/types-centre',
  centres: '/centres',
  fournisseurs: '/fournisseurs',
  familles: '/familles',
  formes: '/formes-medicament',
  unitesVente: '/unites-vente',
  fonctions: '/fonctions',
  medicaments: '/medicaments',
}

export default {
  namespaced: true,

  state: () => ({
    typesCentre: [],
    centres: [],
    fournisseurs: [],
    familles: [],
    formes: [],
    unitesVente: [],
    fonctions: [],
    medicaments: [],
  }),

  mutations: {
    /** Remplace une liste complète. */
    DEFINIR_LISTE(state, { liste, elements }) {
      state[liste] = elements
    },
  },

  actions: {
    /**
     * Charge une liste depuis l'API.
     * @param liste   'typesCentre' | 'centres' | 'fournisseurs' | 'familles' | 'formes' | 'unitesVente' | 'fonctions' | 'medicaments'
     * @param filtres paramètres de recherche facultatifs (ex. { recherche, actifs: true })
     */
    async charger({ commit }, { liste, filtres = {} }) {
      const reponse = await http.get(ADRESSES[liste], { params: filtres })
      commit('DEFINIR_LISTE', { liste, elements: reponse.data })
      return reponse.data
    },

    /**
     * Crée (pas d'id) ou modifie (id présent) un élément.
     * On n'envoie que les champs remplis (les champs vides deviennent "absents").
     */
    async enregistrer(_contexte, { liste, element }) {
      const { id, ...donnees } = nettoyer(element, !!element.id)
      if (id) {
        const reponse = await http.patch(`${ADRESSES[liste]}/${id}`, donnees)
        return reponse.data
      }
      const reponse = await http.post(ADRESSES[liste], donnees)
      return reponse.data
    },

    /** Active ou désactive un élément (centre, fournisseur, médicament). */
    async changerActif(_contexte, { liste, element, actif }) {
      const reponse = await http.patch(`${ADRESSES[liste]}/${element.id}`, { actif })
      return reponse.data
    },

    /** Supprime un élément (utilisé seulement pour les familles). */
    async supprimer(_contexte, { liste, element }) {
      await http.delete(`${ADRESSES[liste]}/${element.id}`)
    },
  },
}

/**
 * Prépare les données avant envoi :
 *   - retire les champs calculés renvoyés par l'API (famille, _count, prix...) ;
 *   - champs vides ("") :
 *       * en CRÉATION     : non envoyés ;
 *       * en MODIFICATION : envoyés à null, pour EFFACER l'ancienne valeur
 *         (ex. un numéro de téléphone supprimé).
 */
function nettoyer(element, modeModification) {
  const champsAIgnorer = ['famille', 'forme', 'uniteVente', 'type', '_count', 'prixVenteActuel', 'prixAchatActuel', 'stockActuel', 'createdAt', 'updatedAt']
  const resultat = {}
  for (const [cle, valeur] of Object.entries(element)) {
    if (champsAIgnorer.includes(cle)) continue
    const estVide = valeur === '' || valeur === null || valeur === undefined
    if (estVide) {
      if (modeModification) resultat[cle] = null
      continue
    }
    resultat[cle] = valeur
  }
  return resultat
}
