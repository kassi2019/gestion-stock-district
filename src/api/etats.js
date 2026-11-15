/**
 * =============================================================================
 * APPELS API : MODULE 09 — TABLEAU DE BORD ET ÉTATS (lecture seule)
 * =============================================================================
 * Filtres communs : { du, au, centreId, fournisseurId, medicamentId }.
 * =============================================================================
 */
import http from '@/api/http'

function filtresPropres(filtres = {}) {
  return Object.fromEntries(Object.entries(filtres).filter(([, v]) => v !== null && v !== undefined && v !== ''))
}

/**
 * Données d'un état.
 * @param source 'tableau-de-bord', 'stock', 'receptions', 'livraisons', 'mouvements',
 *               'consommations', 'factures', 'encaissements', 'creances', 'produits', 'ecarts'
 */
export async function chargerEtat(source, filtres) {
  return (await http.get(`/etats/${source}`, { params: filtresPropres(filtres) })).data
}
