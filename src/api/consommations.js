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

// ----------------------------------------------------------------------------
// RAPPORT CENTRE DE SANTÉ (spec nov. 2026) — remplace la commande du centre
// ----------------------------------------------------------------------------

/** Liste des rapports centre : filtres { centreId, annee, mois, statut }. */
export async function listerRapportsCentre(filtres) {
  return (await http.get('/rapports-centre', { params: filtresPropres(filtres) })).data
}

/** Un rapport centre : lignes calculées, stock du district, transferts, peutValider / raisonBlocage. */
export async function trouverRapportCentre(id) {
  return (await http.get(`/rapports-centre/${id}`)).data
}

/** Ouvre le rapport d'un centre pour un mois (créé en brouillon s'il n'existe pas). */
export async function ouvrirRapportCentre(centreId, annee, mois) {
  return (await http.post('/rapports-centre', { centreId, annee, mois })).data
}

/** Enregistre le brouillon : { lignes: [{ medicamentId, consomme, stockRestant|null, joursRupture, quantiteValidee|null }], observations }. */
export async function enregistrerRapportCentre(id, donnees) {
  return (await http.put(`/rapports-centre/${id}`, donnees)).data
}

/** Valide le rapport (même données) : stock du centre, facture-sortie, verrouillage. */
export async function validerRapportCentre(id, donnees) {
  return (await http.post(`/rapports-centre/${id}/valider`, donnees)).data
}

export async function supprimerRapportCentre(id) {
  return (await http.delete(`/rapports-centre/${id}`)).data
}

/** Rouvre un rapport validé (administrateur) : la facture générée est annulée. */
export async function rouvrirRapportCentre(id, motif) {
  return (await http.post(`/rapports-centre/${id}/rouvrir`, { motif })).data
}

/** Transfert cédé à un autre centre : { centreDestinationId, medicamentId, quantite, motif }. */
export async function ajouterTransfert(rapportId, donnees) {
  return (await http.post(`/rapports-centre/${rapportId}/transferts`, donnees)).data
}

export async function supprimerTransfert(transfertId) {
  return (await http.delete(`/rapports-centre/transferts/${transfertId}`)).data
}

/** Tableau de suivi des rapports centre d'une année : [{ centre, mois: { 1: { id, statut, ... } } }]. */
export async function suiviRapportsCentre(annee) {
  return (await http.get('/rapports-centre/suivi', { params: { annee } })).data
}
