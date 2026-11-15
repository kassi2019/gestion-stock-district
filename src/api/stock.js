/**
 * =============================================================================
 * APPELS API : MODULE 04 — GESTION DU DÉPÔT ET DES STOCKS
 * =============================================================================
 * (Pièces justificatives : src/api/pieces.js avec le module 'stock')
 * =============================================================================
 */
import http from '@/api/http'

function filtresPropres(filtres = {}) {
  return Object.fromEntries(Object.entries(filtres).filter(([, v]) => v !== null && v !== undefined && v !== ''))
}

/** Stock par médicament (avec lots, valeur au prix d'achat / de vente). */
export async function etatStock() {
  return (await http.get('/stock/etat')).data
}

/** Historique des mouvements : filtres { medicamentId, type, du, au }. */
export async function listerMouvements(filtres) {
  return (await http.get('/stock/mouvements', { params: filtresPropres(filtres) })).data
}

/**
 * Mouvement manuel (appliqué immédiatement) :
 * { type, medicamentId, quantite, motif, pieceRef?,
 *   lotId? (sortie), numeroLot? + datePeremption? (entrée) }
 */
export async function creerMouvement(donnees) {
  return (await http.post('/stock/mouvements', donnees)).data
}

/** Fiche de stock d'un médicament sur une période : { medicament, stockInitial, entrees, sorties, stockFinal, mouvements }. */
export async function ficheStock(medicamentId, du, au) {
  return (await http.get(`/stock/fiche/${medicamentId}`, { params: filtresPropres({ du, au }) })).data
}

// ----------------------------------------------------------------------------
// INVENTAIRE PAR LOT
// ----------------------------------------------------------------------------

/**
 * Valide le comptage d'un ou plusieurs lots :
 * lignes = [{ stockId, quantiteReelle, numeroLot?, datePeremption?, commentaire? }]
 * Renvoie { ajustes, total }.
 */
export async function validerComptage(lignes) {
  return (await http.post('/stock/inventaire/comptage', { lignes })).data
}

/** Rattache du stock « sans lot » à un lot : { medicamentId, numeroLot, datePeremption, quantite }. */
export async function rattacherLot(donnees) {
  return (await http.post('/stock/inventaire/rattacher', donnees)).data
}

/** Fiche d'inventaire : lots comptés sur la période { lignes, resume }. */
export async function ficheInventaire(du, au) {
  return (await http.get('/stock/inventaire/fiche', { params: filtresPropres({ du, au }) })).data
}

// ----------------------------------------------------------------------------
// LOTS PÉRIMÉS ET ALERTES
// ----------------------------------------------------------------------------

/** Sort du stock TOUS les lots périmés : { motif?, pieceRef? (n° de PV) }. Renvoie { lots, quantite }. */
export async function sortirLotsPerimes(donnees) {
  return (await http.post('/stock/perimes/sortir', donnees)).data
}

/** Résumé des alertes de stock (accueil) : ruptures, sous le seuil, lots périmés / proches, exemples. */
export async function resumeAlertes() {
  return (await http.get('/stock/alertes/resume')).data
}

/** Modifie le SEUIL D'ALERTE d'un médicament (stock minimum au dépôt ; 0 = pas d'alerte). */
export async function modifierSeuil(medicamentId, seuilAlerte) {
  return (await http.patch(`/stock/seuil/${medicamentId}`, { seuilAlerte })).data
}
