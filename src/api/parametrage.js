/**
 * =============================================================================
 * APPELS API : PRIX ET PARAMÈTRES GÉNÉRAUX (module 01 Paramétrage)
 * =============================================================================
 * Les listes (centres, fournisseurs, familles, médicaments) passent par le
 * store Vuex "referentiel". Les prix et paramètres, utilisés seulement dans
 * le Paramétrage, sont appelés directement avec les fonctions ci-dessous.
 * =============================================================================
 */
import http from '@/api/http'

// ----------------------------------------------------------------------------
// PRIX
// ----------------------------------------------------------------------------

/** Historique des prix de vente d'un médicament. */
export async function historiquePrixVente(medicamentId) {
  const reponse = await http.get('/prix/vente', { params: { medicamentId } })
  return reponse.data
}

/** Historique des prix d'achat d'un médicament. */
export async function historiquePrixAchat(medicamentId) {
  const reponse = await http.get('/prix/achat', { params: { medicamentId } })
  return reponse.data
}

/**
 * Nouveau prix de vente.
 * @param donnees { medicamentId, prix, dateEffet: 'AAAA-MM-JJ', centreId? }
 */
export async function creerPrixVente(donnees) {
  const reponse = await http.post('/prix/vente', donnees)
  return reponse.data
}

/**
 * Nouveau prix d'achat.
 * @param donnees { medicamentId, prix, dateEffet: 'AAAA-MM-JJ', fournisseurId? }
 */
export async function creerPrixAchat(donnees) {
  const reponse = await http.post('/prix/achat', donnees)
  return reponse.data
}

/**
 * Corrige le prix de vente EN COURS (erreur de saisie).
 * @param id      identifiant du prix (ligne de l'historique)
 * @param donnees { prix, motif }
 */
export async function corrigerPrixVente(id, donnees) {
  const reponse = await http.patch(`/prix/vente/${id}/corriger`, donnees)
  return reponse.data
}

/** Corrige le prix d'achat EN COURS (erreur de saisie). */
export async function corrigerPrixAchat(id, donnees) {
  const reponse = await http.patch(`/prix/achat/${id}/corriger`, donnees)
  return reponse.data
}

// ----------------------------------------------------------------------------
// PARAMÈTRES GÉNÉRAUX
// ----------------------------------------------------------------------------

/** Liste des paramètres généraux. */
export async function listerParametres() {
  const reponse = await http.get('/parametres')
  return reponse.data
}

/** Change la valeur d'un paramètre. */
export async function modifierParametre(cle, valeur) {
  const reponse = await http.patch(`/parametres/${cle}`, { valeur })
  return reponse.data
}
