/**
 * =============================================================================
 * APPELS API : MODULE 03 — APPROVISIONNEMENTS ET ACHATS
 * =============================================================================
 *   - COMMANDES fournisseurs (brouillon -> validée -> reçue) ;
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
// COMMANDES FOURNISSEURS
// ----------------------------------------------------------------------------

/** Liste des commandes : filtres { fournisseurId, statut, du, au } (dates AAAA-MM-JJ). */
export async function listerCommandes(filtres) {
  return (await http.get('/achats/commandes', { params: filtresPropres(filtres) })).data
}

/** Une commande avec ses lignes et ses réceptions. */
export async function trouverCommande(id) {
  return (await http.get(`/achats/commandes/${id}`)).data
}

/** Nouvelle commande (brouillon) : { fournisseurId, dateCommande, observations, lignes: [{ medicamentId, quantite, prixUnitaire }] }. */
export async function creerCommande(donnees) {
  return (await http.post('/achats/commandes', donnees)).data
}

/** Modification d'une commande en brouillon (les lignes sont remplacées). */
export async function modifierCommande(id, donnees) {
  return (await http.patch(`/achats/commandes/${id}`, donnees)).data
}

export async function validerCommande(id) {
  return (await http.post(`/achats/commandes/${id}/valider`)).data
}

export async function annulerCommande(id) {
  return (await http.post(`/achats/commandes/${id}/annuler`)).data
}

// ----------------------------------------------------------------------------
// RÉCEPTIONS
// ----------------------------------------------------------------------------

/** Liste des réceptions : filtres { fournisseurId, commandeId, statut, du, au }. */
export async function listerReceptions(filtres) {
  return (await http.get('/achats/receptions', { params: filtresPropres(filtres) })).data
}

export async function trouverReception(id) {
  return (await http.get(`/achats/receptions/${id}`)).data
}

/**
 * Nouvelle réception (brouillon) :
 * { commandeId?, fournisseurId?, dateReception, numFactureFourn?, numBonLivraison?, observations?,
 *   lignes: [{ medicamentId, quantite, prixUnitaire, numeroLot?, datePeremption? }] }
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
