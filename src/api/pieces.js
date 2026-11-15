/**
 * =============================================================================
 * APPELS API : PIÈCES JUSTIFICATIVES (fichiers joints aux documents)
 * =============================================================================
 * Chaque module a ses propres routes (et donc ses propres droits) :
 *   - module 'achats' : commandes ('CommandeFournisseur'), réceptions ('Reception')
 *   - module 'stock'  : mouvements ('MouvementStock'), inventaires ('InventaireDepot')
 * =============================================================================
 */
import http from '@/api/http'

/** Pièces jointes d'un document. */
export async function listerPieces(module, type, id) {
  return (await http.get(`/${module}/pieces/${type}/${id}`)).data
}

/** Ajoute un fichier (PDF, JPEG, PNG ; 10 Mo max) avec un libellé (ex. « Facture fournisseur »). */
export async function ajouterPiece(module, type, id, fichier, libelle) {
  const formulaire = new FormData()
  formulaire.append('fichier', fichier)
  if (libelle) formulaire.append('libelle', libelle)
  return (await http.post(`/${module}/pieces/${type}/${id}`, formulaire)).data
}

/** Ouvre une pièce jointe dans un nouvel onglet (le fichier est téléchargé avec la session). */
export async function ouvrirPiece(module, id) {
  const reponse = await http.get(`/${module}/pieces/${id}/fichier`, { responseType: 'blob' })
  const adresse = URL.createObjectURL(reponse.data)
  window.open(adresse, '_blank')
  setTimeout(() => URL.revokeObjectURL(adresse), 60000)
}

export async function supprimerPiece(module, id) {
  return (await http.delete(`/${module}/pieces/${id}`)).data
}
