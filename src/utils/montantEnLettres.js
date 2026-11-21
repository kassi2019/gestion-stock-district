/**
 * =============================================================================
 * MONTANT EN LETTRES (français), pour les reçus
 * =============================================================================
 *   montantEnLettres(250000)  -> "deux cent cinquante mille"
 *   montantEnLettres(1580)    -> "mille cinq cent quatre-vingts"
 *   montantEnLettres(2000000) -> "deux millions"
 * Le franc CFA n'a pas de centimes : le montant est arrondi à l'unité.
 * Règles appliquées (orthographe traditionnelle) :
 *   - « et » dans 21, 31, 41, 51, 61, 71 (vingt et un, soixante et onze) ;
 *   - « quatre-vingts » et « deux cents » prennent un s seulement à la fin
 *     du nombre ou devant million / milliard (pas devant mille) ;
 *   - « mille » est invariable et on ne dit pas « un mille ».
 * =============================================================================
 */

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
]
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

/** Nombre de 0 à 99. finDeNombre : true si rien ne suit (pour le s de quatre-vingts). */
function moinsDeCent(n, finDeNombre) {
  if (n < 20) return UNITES[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  // 70 à 79 : soixante + (10 à 19) ; 90 à 99 : quatre-vingt + (10 à 19)
  if (d === 7 || d === 9) {
    const base = d === 7 ? 'soixante' : 'quatre-vingt'
    const reste = 10 + u
    return d === 7 && u === 1 ? 'soixante et onze' : `${base}-${UNITES[reste]}`
  }
  if (d === 8) {
    if (u === 0) return finDeNombre ? 'quatre-vingts' : 'quatre-vingt'
    return `quatre-vingt-${UNITES[u]}`
  }
  if (u === 0) return DIZAINES[d]
  if (u === 1) return `${DIZAINES[d]} et un`
  return `${DIZAINES[d]}-${UNITES[u]}`
}

/** Nombre de 0 à 999. */
function moinsDeMille(n, finDeNombre) {
  const c = Math.floor(n / 100)
  const reste = n % 100
  if (c === 0) return moinsDeCent(reste, finDeNombre)
  let texte = c === 1 ? 'cent' : `${UNITES[c]} cent`
  if (reste === 0) return c > 1 && finDeNombre ? `${texte}s` : texte
  texte += ` ${moinsDeCent(reste, finDeNombre)}`
  return texte
}

/** Montant entier en toutes lettres (ex. 125000 -> "cent vingt-cinq mille"). */
export function montantEnLettres(valeur) {
  let n = Math.round(Math.abs(Number(valeur) || 0))
  if (n === 0) return 'zéro'

  const milliards = Math.floor(n / 1e9)
  n %= 1e9
  const millions = Math.floor(n / 1e6)
  n %= 1e6
  const milliers = Math.floor(n / 1000)
  const unites = n % 1000

  const morceaux = []
  // Devant million / milliard (des noms), cents et quatre-vingts gardent leur s
  if (milliards) morceaux.push(`${moinsDeMille(milliards, true)} milliard${milliards > 1 ? 's' : ''}`)
  if (millions) morceaux.push(`${moinsDeMille(millions, true)} million${millions > 1 ? 's' : ''}`)
  // Devant mille : pas de s (« deux cent mille », « quatre-vingt mille »)
  if (milliers) morceaux.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, false)} mille`)
  if (unites) morceaux.push(moinsDeMille(unites, true))
  return morceaux.join(' ')
}
