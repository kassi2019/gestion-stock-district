/**
 * =============================================================================
 * APPELS API : MODULE 06 — RAPPORTS MENSUELS DE CONSOMMATION
 * =============================================================================
 * (Pièces justificatives : src/api/pieces.js avec le module 'consommations')
 * =============================================================================
 */
import http from '@/api/http'

function filtresPropres(filtres = {}) {
  return Object.fromEntries(Object.entries(filtres).filter(([, v]) => v !== null && v !== undefined && v !== ''))
}

/** Liste : filtres { centreId, annee, mois, statut }. */
export async function listerRapports(filtres) {
  return (await http.get('/consommations/rapports', { params: filtresPropres(filtres) })).data
}

/** Un rapport : lignes (déclaré, vérifié, prix, montant, stock théorique du centre). */
export async function trouverRapport(id) {
  return (await http.get(`/consommations/rapports/${id}`)).data
}

/** Nouveau rapport : { centreId, annee, mois, observations?, lignes: [{ medicamentId, quantite }] }. */
export async function creerRapport(donnees) {
  return (await http.post('/consommations/rapports', donnees)).data
}

export async function modifierRapport(id, donnees) {
  return (await http.patch(`/consommations/rapports/${id}`, donnees)).data
}

export async function supprimerRapport(id) {
  return (await http.delete(`/consommations/rapports/${id}`)).data
}

export async function soumettreRapport(id) {
  return (await http.post(`/consommations/rapports/${id}/soumettre`)).data
}

/** Renvoi en brouillon (rapport à corriger) avec un motif. */
export async function renvoyerRapport(id, motif) {
  return (await http.post(`/consommations/rapports/${id}/renvoyer`, { motif })).data
}

/**
 * VÉRIFICATION SUR PLACE : { dateVerification, agents?, observations?,
 *   lignes: [{ ligneId, quantiteVerifiee (null = non vérifiée), commentaire? }] }.
 */
export async function verifierRapport(id, donnees) {
  return (await http.post(`/consommations/rapports/${id}/verifier`, donnees)).data
}

/** VALIDATION : quantités retenues déduites du stock théorique du centre. */
export async function validerRapport(id) {
  return (await http.post(`/consommations/rapports/${id}/valider`)).data
}

/** Tableau de suivi d'une année : [{ centre, mois: { 1: { statut, montantTotal, ... } } }]. */
export async function suiviAnnuel(annee) {
  return (await http.get('/consommations/suivi', { params: { annee } })).data
}

/** Stock théorique d'un centre (aide à la saisie). */
export async function stockDuCentre(centreId) {
  return (await http.get(`/consommations/stock-centre/${centreId}`)).data
}
