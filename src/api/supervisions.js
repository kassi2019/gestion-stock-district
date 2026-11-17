/**
 * =============================================================================
 * APPELS API : MODULE 08 — SUPERVISIONS ET INVENTAIRES DANS LES CENTRES
 * =============================================================================
 * (Pièces justificatives : src/api/pieces.js avec le module 'supervisions')
 * =============================================================================
 */
import http from '@/api/http'

function filtresPropres(filtres = {}) {
  return Object.fromEntries(Object.entries(filtres).filter(([, v]) => v !== null && v !== undefined && v !== ''))
}

/** Liste : filtres { centreId, statut, du, au }. */
export async function listerSupervisions(filtres) {
  return (await http.get('/supervisions', { params: filtresPropres(filtres) })).data
}

/** Une supervision : agents, lignes (théorique, physique, écart, valeur), décision, facture. */
export async function trouverSupervision(id) {
  return (await http.get(`/supervisions/${id}`)).data
}

/** Personnel proposé pour « Agents présents » : district + centre choisi. [{ id, nom, fonction, lieu, utilisateurId }] */
export async function agentsPossibles(centreId) {
  return (await http.get('/supervisions/agents', { params: filtresPropres({ centreId }) })).data
}

/** Aide à la saisie : { medicaments: [{ medicamentId, medicament, stockTheorique }], lots: [...] } à la date. */
export async function preparationSupervision(centreId, date) {
  return (await http.get(`/supervisions/preparation/${centreId}`, { params: filtresPropres({ date }) })).data
}

/** Écarts constatés (supervisions validées / clôturées) : filtres { centreId, du, au }. */
export async function listerEcarts(filtres) {
  return (await http.get('/supervisions/ecarts', { params: filtresPropres(filtres) })).data
}

/** Nouveau constat : { centreId, dateSupervision, observations?, agents: [{ nom, fonction? }], lignes: [{ medicamentId, lotId?, stockPhysique, commentaire? }] }. */
export async function creerSupervision(donnees) {
  return (await http.post('/supervisions', donnees)).data
}

export async function modifierSupervision(id, donnees) {
  return (await http.patch(`/supervisions/${id}`, donnees)).data
}

export async function supprimerSupervision(id) {
  return (await http.delete(`/supervisions/${id}`)).data
}

export async function soumettreSupervision(id) {
  return (await http.post(`/supervisions/${id}/soumettre`)).data
}

export async function renvoyerSupervision(id, motif) {
  return (await http.post(`/supervisions/${id}/renvoyer`, { motif })).data
}

/** Validation du constat (aucun effet sur le stock ni les comptes). */
export async function validerSupervision(id) {
  return (await http.post(`/supervisions/${id}/valider`)).data
}

/** Décision : { decision: 'AUCUNE' | 'REGULARISATION_STOCK' | 'FACTURATION', motif, dateFacture? }. */
export async function deciderSupervision(id, donnees) {
  return (await http.post(`/supervisions/${id}/decider`, donnees)).data
}
