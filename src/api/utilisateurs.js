/**
 * =============================================================================
 * APPELS API : UTILISATEURS (module 02)
 * =============================================================================
 *   - PERSONNEL : fiches du personnel (+ compte utilisateur en même temps) ;
 *   - COMPTES   : identifiant, profil, activation, mots de passe ;
 *   - PROFILS   : rôles et droits par module.
 * =============================================================================
 */
import http from '@/api/http'

// ----------------------------------------------------------------------------
// COMPTES UTILISATEURS
// ----------------------------------------------------------------------------

/** Liste des comptes utilisateurs. */
export async function listerUtilisateurs() {
  const reponse = await http.get('/utilisateurs')
  return reponse.data
}

/** Liste simple des profils (pour les listes déroulantes). */
export async function listerRoles() {
  const reponse = await http.get('/utilisateurs/roles')
  return reponse.data
}

/**
 * Création d'un compte pour un membre du personnel.
 * @param donnees { personnelId, motDePasse, roleId }  (identifiant = matricule de la personne)
 */
export async function creerUtilisateur(donnees) {
  const reponse = await http.post('/utilisateurs', donnees)
  return reponse.data
}

/** Modification d'un compte : { roleId } ou activation : { actif: false }. */
export async function modifierUtilisateur(id, donnees) {
  const reponse = await http.patch(`/utilisateurs/${id}`, donnees)
  return reponse.data
}

/** L'administrateur définit un nouveau mot de passe pour un utilisateur. */
export async function reinitialiserMotDePasse(id, nouveauMotDePasse) {
  const reponse = await http.patch(`/utilisateurs/${id}/mot-de-passe`, { nouveauMotDePasse })
  return reponse.data
}

/** L'utilisateur connecté change SON mot de passe (tout profil). */
export async function changerMonMotDePasse(ancienMotDePasse, nouveauMotDePasse) {
  const reponse = await http.patch('/utilisateurs/moi/mot-de-passe', { ancienMotDePasse, nouveauMotDePasse })
  return reponse.data
}

// ----------------------------------------------------------------------------
// PERSONNEL
// ----------------------------------------------------------------------------

/** Liste du personnel (avec affectation et compte). */
export async function listerPersonnel() {
  const reponse = await http.get('/personnel')
  return reponse.data
}

/**
 * Nouvelle fiche du personnel.
 * @param donnees { matricule?, nom, prenoms?, fonction?, centreId?, telephone?, email?,
 *                  compte?: { motDePasse, roleId } }  <- compte créé en même temps
 *                  (identifiant de connexion = matricule)
 */
export async function creerPersonnel(donnees) {
  const reponse = await http.post('/personnel', donnees)
  return reponse.data
}

/** Modification d'une fiche, ou activation : { actif: false } (le compte suit). */
export async function modifierPersonnel(id, donnees) {
  const reponse = await http.patch(`/personnel/${id}`, donnees)
  return reponse.data
}

/**
 * Crée le compte utilisateur d'une personne qui n'en a pas : { motDePasse, roleId }.
 * (L'identifiant de connexion est son MATRICULE.)
 */
export async function creerComptePersonnel(id, compte) {
  const reponse = await http.post(`/personnel/${id}/compte`, compte)
  return reponse.data
}

// ----------------------------------------------------------------------------
// PROFILS ET DROITS PAR MODULE
// ----------------------------------------------------------------------------

/** Profils avec leurs droits ({ parametrage: ['VOIR', 'IMPRIMER', 'MODIFIER'], ... }) et leur nombre de comptes. */
export async function listerProfils() {
  const reponse = await http.get('/roles')
  return reponse.data
}

/** Nouveau profil : { code, libelle, description?, permissions: { module: ['VOIR', ...] } }. (Administrateur) */
export async function creerProfil(donnees) {
  const reponse = await http.post('/roles', donnees)
  return reponse.data
}

/** Modification d'un profil (libellé, description, droits). (Administrateur) */
export async function modifierProfil(id, donnees) {
  const reponse = await http.patch(`/roles/${id}`, donnees)
  return reponse.data
}

/** Suppression d'un profil (seulement si aucun compte ne l'utilise). (Administrateur) */
export async function supprimerProfil(id) {
  const reponse = await http.delete(`/roles/${id}`)
  return reponse.data
}

// ----------------------------------------------------------------------------
// OUTILS
// ----------------------------------------------------------------------------

/**
 * Vérifie la règle des mots de passe (la même que le backend) :
 * au moins 8 caractères, au moins une lettre et un chiffre.
 * Renvoie un message d'erreur, ou '' si le mot de passe est correct.
 */
export function verifierMotDePasse(motDePasse, confirmation) {
  if (!motDePasse || motDePasse.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.'
  if (!/[A-Za-z]/.test(motDePasse) || !/\d/.test(motDePasse)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.'
  }
  if (confirmation !== undefined && motDePasse !== confirmation) {
    return 'La confirmation ne correspond pas au mot de passe.'
  }
  return ''
}
