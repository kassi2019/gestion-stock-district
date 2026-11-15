/**
 * =============================================================================
 * APPEL API : PAGE D'ACCUEIL
 * =============================================================================
 * Chiffres clés du bandeau et badges « en attente » des tuiles, calculés par
 * le serveur à partir de la base (seulement les modules visibles par
 * l'utilisateur connecté).
 * =============================================================================
 */
import http from '@/api/http'

/** { indicateurs: { stock?, alertes?, creances?, rapports? }, enAttente: { [module]: { nombre, libelle } | null } } */
export async function resumeAccueil() {
  return (await http.get('/accueil/resume')).data
}
