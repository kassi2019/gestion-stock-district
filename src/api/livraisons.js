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
// COMMANDES DES CENTRES
// ----------------------------------------------------------------------------

/** Liste : filtres { centreId, statut, du, au }. */
export async function listerCommandesCentre(filtres) {
  return (await http.get('/livraisons/commandes', { params: filtresPropres(filtres) })).data
}

/** Une commande : lignes (demandé, accordé, livré, disponible au dépôt), livraisons. */
export async function trouverCommandeCentre(id) {
  return (await http.get(`/livraisons/commandes/${id}`)).data
}

/** Nouvelle commande : { centreId, dateCommande, observations?, lignes: [{ medicamentId, quantiteDemandee }] }. */
export async function creerCommandeCentre(donnees) {
  return (await http.post('/livraisons/commandes', donnees)).data
}

export async function modifierCommandeCentre(id, donnees) {
  return (await http.patch(`/livraisons/commandes/${id}`, donnees)).data
}

/** Validation : quantités accordées [{ ligneId, quantiteAccordee }]. */
export async function validerCommandeCentre(id, lignes) {
  return (await http.post(`/livraisons/commandes/${id}/valider`, { lignes })).data
}

export async function annulerCommandeCentre(id) {
  return (await http.post(`/livraisons/commandes/${id}/annuler`)).data
}

// ----------------------------------------------------------------------------
// BONS DE LIVRAISON
// ----------------------------------------------------------------------------

/** Liste : filtres { centreId, commandeId, statut, du, au }. */
export async function listerLivraisons(filtres) {
  return (await http.get('/livraisons/bons', { params: filtresPropres(filtres) })).data
}

/** Un bon de livraison : lignes PAR LOT (préparé, livré, prix, montant). */
export async function trouverLivraison(id) {
  return (await http.get(`/livraisons/bons/${id}`)).data
}

/**
 * Préparation (brouillon) : { commandeId? | centreId?, dateLivraison, observations?,
 *   lignes: [{ medicamentId, quantite }] } -> les lots sont choisis automatiquement.
 */
export async function creerLivraison(donnees) {
  return (await http.post('/livraisons/bons', donnees)).data
}

export async function modifierLivraison(id, donnees) {
  return (await http.patch(`/livraisons/bons/${id}`, donnees)).data
}

/** VALIDATION : quantités livrées [{ ligneId, quantiteLivree }] -> sortie du dépôt + stock du centre. */
export async function validerLivraison(id, lignes) {
  return (await http.post(`/livraisons/bons/${id}/valider`, { lignes })).data
}

export async function annulerLivraison(id) {
  return (await http.post(`/livraisons/bons/${id}/annuler`)).data
}

// ----------------------------------------------------------------------------
// DISPONIBILITÉS ET FICHE D'UN CENTRE
// ----------------------------------------------------------------------------

/** Stock utilisable au dépôt (lots non périmés, préparations en cours déduites) : { [medicamentId]: quantité }. */
export async function disponibilites(medicamentIds) {
  if (!medicamentIds.length) return {}
  return (await http.get('/livraisons/disponibilites', { params: { ids: medicamentIds.join(',') } })).data
}

/** TOUS les médicaments disponibles au dépôt (stock utilisable > 0, lots non périmés) : { [medicamentId]: quantité }. */
export async function medicamentsDisponibles() {
  return (await http.get('/livraisons/disponibilites')).data
}

/** Fiche d'un centre : { centre, stock (théorique), livraisons, mouvements }. */
export async function ficheCentre(id) {
  return (await http.get(`/livraisons/centres/${id}`)).data
}
