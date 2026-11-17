/**
 * =============================================================================
 * APPELS API : MODULE 03 — APPROVISIONNEMENTS ET ACHATS
 * =============================================================================
 *   - RÉCEPTIONS (brouillon -> VALIDÉE = entrée en stock) ;
 *   - HISTORIQUE des achats ;
 *   - PIÈCES JUSTIFICATIVES (fichiers joints).
 * Les filtres vides ne sont pas envoyés.
 * =============================================================================
 */
import http from '@/api/http'

/** Retire les filtres vides (null, '') avant l'envoi. */
function filtresPropres(filtres = {}) {
  return Object.fromEntries(Object.entries(filtres).filter(([, v]) => v !== null && v !== undefined && v !== ''))
}

// ----------------------------------------------------------------------------
// RÉCEPTIONS
// ----------------------------------------------------------------------------

/** Liste des réceptions : filtres { fournisseurId, statut, du, au }. */
export async function listerReceptions(filtres) {
  return (await http.get('/achats/receptions', { params: filtresPropres(filtres) })).data
}

/**
 * Prix d'achat repris des paramètres (non modifiables à la saisie).
 * Renvoie { medicamentId: prix } (prix = null s'il n'est pas défini).
 */
export async function prixAchatReception({ medicamentIds, fournisseurId, date }) {
  if (!medicamentIds.length) return {}
  const params = filtresPropres({ medicamentIds: medicamentIds.join(','), fournisseurId, date })
  return (await http.get('/achats/prix-achat', { params })).data
}

export async function trouverReception(id) {
  return (await http.get(`/achats/receptions/${id}`)).data
}

/**
 * Nouvelle réception (brouillon) :
 * { fournisseurId, dateReception, numFactureFourn?, numBonLivraison?, observations?,
 *   lignes: [{ medicamentId, quantite, numeroLot?, datePeremption? }] }  (prix repris des paramètres)
 */
export async function creerReception(donnees) {
  return (await http.post('/achats/receptions', donnees)).data
}

export async function modifierReception(id, donnees) {
  return (await http.patch(`/achats/receptions/${id}`, donnees)).data
}

/** VALIDATION : entrée en stock du dépôt (irréversible). */
export async function validerReception(id) {
  return (await http.post(`/achats/receptions/${id}/valider`)).data
}

export async function annulerReception(id) {
  return (await http.post(`/achats/receptions/${id}/annuler`)).data
}

// ----------------------------------------------------------------------------
// HISTORIQUE DES ACHATS
// ----------------------------------------------------------------------------

/** Lignes des réceptions validées : filtres { fournisseurId, medicamentId, du, au }. */
export async function historiqueAchats(filtres) {
  return (await http.get('/achats/historique', { params: filtresPropres(filtres) })).data
}

// Pièces justificatives : voir src/api/pieces.js (communes aux modules Achats et Stock)
