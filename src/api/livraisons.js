/**
 * =============================================================================
 * APPELS API : MODULE 05 — COMMANDES ET LIVRAISONS AUX CENTRES
 * =============================================================================
 * (Pièces justificatives : src/api/pieces.js avec le module 'livraisons')
 * =============================================================================
 */
import http from '@/api/http'

function filtresPropres(filtres = {}) {
  return Object.fromEntries(Object.entries(filtres).filter(([, v]) => v !== null && v !== undefined && v !== ''))
}

// ----------------------------------------------------------------------------
// BONS DE LIVRAISON
// ----------------------------------------------------------------------------

/** Anciens bons de livraison : filtres { centreId, statut, du, au }. */
export async function listerLivraisons(filtres) {
  return (await http.get('/livraisons/bons', { params: filtresPropres(filtres) })).data
}

/** Un bon de livraison : lignes PAR LOT (préparé, livré, prix, montant). */
export async function trouverLivraison(id) {
  return (await http.get(`/livraisons/bons/${id}`)).data
}

// ----------------------------------------------------------------------------
// DISPONIBILITÉS ET FICHE D'UN CENTRE
// ----------------------------------------------------------------------------

/** Fiche d'un centre : { centre, stock (théorique), livraisons, mouvements }. */
export async function ficheCentre(id) {
  return (await http.get(`/livraisons/centres/${id}`)).data
}
