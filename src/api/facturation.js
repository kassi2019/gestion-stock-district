/**
 * =============================================================================
 * APPELS API : MODULE 07 — FACTURATION ET COMPTES CLIENTS
 * =============================================================================
 *   - factures      (droits du module « facturation ») ;
 *   - paiements, avances, situation et relevé des centres (module « paiements »).
 * =============================================================================
 */
import http from '@/api/http'

function filtresPropres(filtres = {}) {
  return Object.fromEntries(Object.entries(filtres).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false))
}

// ----------------------------------------------------------------------------
// FACTURES
// ----------------------------------------------------------------------------

/** Liste : filtres { centreId, statut, du, au, nonSoldees: 1 }. */
export async function listerFactures(filtres) {
  return (await http.get('/facturation/factures', { params: filtresPropres(filtres) })).data
}

/** Une facture : lignes, paiements imputés, solde, avances disponibles du centre. */
export async function trouverFacture(id) {
  return (await http.get(`/facturation/factures/${id}`)).data
}

/** Rapports de consommation validés, pas encore facturés. */
export async function rapportsAFacturer() {
  return (await http.get('/facturation/a-facturer')).data
}

/** Génère une facture par rapport : { rapportIds, dateEmission? }. */
export async function genererFactures(rapportIds, dateEmission) {
  return (await http.post('/facturation/factures/generer', { rapportIds, dateEmission })).data
}

export async function annulerFacture(id, motif) {
  return (await http.post(`/facturation/factures/${id}/annuler`, { motif })).data
}

// ----------------------------------------------------------------------------
// PAIEMENTS ET AVANCES
// ----------------------------------------------------------------------------

/** Liste : filtres { centreId, du, au, mode, avecAvance: 1 }. */
export async function listerPaiements(filtres) {
  return (await http.get('/paiements', { params: filtresPropres(filtres) })).data
}

export async function trouverPaiement(id) {
  return (await http.get(`/paiements/${id}`)).data
}

/** Factures non soldées d'un centre (les plus anciennes d'abord). */
export async function facturesNonSoldees(centreId) {
  return (await http.get(`/paiements/factures-non-soldees/${centreId}`)).data
}

/**
 * Paiement : { centreId, datePaiement, montant, mode, reference?, observations?,
 *   imputations: [{ factureId, montant }] } — le reste non réparti devient une avance.
 */
export async function creerPaiement(donnees) {
  return (await http.post('/paiements', donnees)).data
}

/** Impute l'avance (montant non imputé) d'un paiement : [{ factureId, montant }]. */
export async function imputerPaiement(id, imputations) {
  return (await http.post(`/paiements/${id}/imputer`, { imputations })).data
}

/** Impute automatiquement les avances disponibles du centre sur une facture. */
export async function imputerAvancesSurFacture(factureId) {
  return (await http.post(`/paiements/imputer-avances/${factureId}`)).data
}

export async function annulerPaiement(id, motif) {
  return (await http.post(`/paiements/${id}/annuler`, { motif })).data
}

// ----------------------------------------------------------------------------
// COMPTES DES CENTRES
// ----------------------------------------------------------------------------

/** Situation de chaque centre : facturé, payé, solde dû, avances, retards. */
export async function situationCentres() {
  return (await http.get('/paiements/situation')).data
}

/** Relevé de compte d'un centre sur une période { du, au }. */
export async function releveCompte(centreId, du, au) {
  return (await http.get(`/paiements/releve/${centreId}`, { params: filtresPropres({ du, au }) })).data
}
