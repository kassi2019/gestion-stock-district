/**
 * =============================================================================
 * FONCTIONS DE MISE EN FORME (affichage des montants et des dates)
 * =============================================================================
 * Utilisation dans un écran :
 *     import { formaterMontant, formaterDate } from '@/utils/format'
 *     formaterMontant(12500)        -> "12 500 FCFA"
 *     formaterDate('2026-11-14')    -> "14/11/2026"
 * =============================================================================
 */

/** Montant avec séparateur de milliers + devise. Vide si pas de valeur. */
export function formaterMontant(valeur, devise = 'FCFA') {
  if (valeur === null || valeur === undefined || valeur === '') return '—'
  const nombre = Number(valeur)
  return `${nombre.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${devise}`
}

/** Nombre avec séparateur de milliers (ex. 12500 -> "12 500"). */
export function formaterNombre(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return '—'
  return Number(valeur).toLocaleString('fr-FR')
}

/**
 * Date au format JJ/MM/AAAA.
 * Accepte une date ISO ("2026-11-14" ou "2026-11-14T00:00:00.000Z").
 */
export function formaterDate(valeur) {
  if (!valeur) return '—'
  const [annee, mois, jour] = String(valeur).substring(0, 10).split('-')
  return `${jour}/${mois}/${annee}`
}

/** Date du jour au format AAAA-MM-JJ (valeur par défaut des champs date). */
export function dateDuJour() {
  const d = new Date()
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const jour = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mois}-${jour}`
}
