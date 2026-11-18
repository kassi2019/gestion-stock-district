/**
 * =============================================================================
 * OUTILS COMMUNS AU MODULE 04 — GESTION DU DÉPÔT ET DES STOCKS
 * =============================================================================
 *   - TYPES DE MOUVEMENTS : libellé, sens (entrée / sortie), couleur ;
 *   - ÉTAT d'un médicament (rupture, sous le seuil, normal) ;
 *   - PÉREMPTION d'un lot (périmé, proche, normal) ;
 *   - FICHE DE STOCK et FICHE D'INVENTAIRE en PDF.
 * =============================================================================
 */
import { exporterDocumentPdf, nomUtilisateurConnecte } from '@/utils/documentPdf'
import { formaterDate, formaterMontant, formaterNombre } from '@/utils/format'

/**
 * Types de mouvements du stock du dépôt.
 * sens : +1 = entrée, -1 = sortie ; manuel : saisissable dans « Nouveau mouvement ».
 * (Une RÉCEPTION est une entrée réelle, distincte d'un AJUSTEMENT.)
 */
export const TYPES_MOUVEMENT = {
  ENTREE_RECEPTION: { libelle: 'Entrée — réception', sens: 1, badge: 'badge-vert' },
  AJUSTEMENT_POSITIF: { libelle: 'Ajustement +', sens: 1, badge: 'badge-bleu', manuel: true, aide: 'Stock trouvé en plus, erreur de saisie en moins…' },
  AJUSTEMENT_NEGATIF: { libelle: 'Ajustement −', sens: -1, badge: 'badge-orange', manuel: true, aide: 'Casse, perte, vol, erreur de saisie en plus…' },
  PERIME: { libelle: 'Sortie — périmés', sens: -1, badge: 'badge-rouge', manuel: true, aide: 'Retrait de produits périmés ou abîmés (destruction)' },
  TRANSFERT_ENTREE: { libelle: 'Transfert entrant', sens: 1, badge: 'badge-bleu', manuel: true, aide: 'Produits reçus d\'un autre dépôt / district' },
  TRANSFERT_SORTIE: { libelle: 'Transfert sortant', sens: -1, badge: 'badge-orange', manuel: true, aide: 'Produits cédés à un autre dépôt / district' },
  SORTIE_LIVRAISON: { libelle: 'Sortie — livraison', sens: -1, badge: 'badge-gris' },
  INVENTAIRE_POSITIF: { libelle: 'Inventaire +', sens: 1, badge: 'badge-bleu' },
  INVENTAIRE_NEGATIF: { libelle: 'Inventaire −', sens: -1, badge: 'badge-orange' },
  REGULARISATION: { libelle: 'Régularisation', sens: 1, badge: 'badge-gris' },
  // Mouvements « neutres » (le stock total ne change pas)
  INVENTAIRE_CONFORME: { libelle: 'Inventaire — conforme', sens: 0, badge: 'badge-vert' },
  RATTACHEMENT_LOT: { libelle: 'Rattachement à un lot', sens: 0, badge: 'badge-gris' },
}

/** Types proposés dans « Nouveau mouvement ». */
export const TYPES_MANUELS = Object.entries(TYPES_MOUVEMENT)
  .filter(([, t]) => t.manuel)
  .map(([id, t]) => ({ id, libelle: t.libelle, aide: t.aide, sens: t.sens }))

/** Liste { id, libelle } de tous les types (filtre). */
export const OPTIONS_TYPES = Object.entries(TYPES_MOUVEMENT).map(([id, t]) => ({ id, libelle: t.libelle }))

/**
 * État d'un médicament selon son stock et son seuil d'alerte.
 * seuilAlerte est CALCULÉ par le serveur à partir de la CMM
 * (CMM × niveau de stock minimum en mois) : voir StockService.etat().
 */
export function etatMedicament(m) {
  if (m.stock <= 0) return { code: 'RUPTURE', libelle: 'Rupture', badge: 'badge-rouge' }
  if (m.seuilAlerte > 0 && m.stock <= m.seuilAlerte) return { code: 'SOUS_SEUIL', libelle: 'Sous le seuil', badge: 'badge-orange' }
  return { code: 'NORMAL', libelle: 'Normal', badge: 'badge-vert' }
}

/** Nombre de jours avant la péremption (négatif = périmé), ou null. */
export function joursAvantPeremption(datePeremption) {
  if (!datePeremption) return null
  const aujourdhui = new Date()
  aujourdhui.setHours(0, 0, 0, 0)
  const fin = new Date(String(datePeremption).substring(0, 10) + 'T00:00:00')
  return Math.round((fin - aujourdhui) / 86400000)
}

/** État de péremption d'un lot selon le délai d'alerte (paramètre ALERTE_PEREMPTION_JOURS). */
export function etatPeremption(datePeremption, delaiAlerte) {
  const jours = joursAvantPeremption(datePeremption)
  if (jours === null) return null
  if (jours < 0) return { code: 'PERIME', libelle: 'Périmé', badge: 'badge-rouge', jours }
  if (jours <= delaiAlerte) return { code: 'PROCHE', libelle: `Expire dans ${jours} j`, badge: 'badge-orange', jours }
  return { code: 'NORMAL', libelle: `${jours} j`, badge: 'badge-vert', jours }
}

/** Nom complet (ex. « Awa BAMBA »). */
function nomPersonne(p) {
  return p ? `${p.prenoms || ''} ${p.nom || ''}`.trim() : ''
}

/** Quantité signée d'un mouvement (ex. « +60 », « −5 », « 0 » ; « ⇄ 5 » pour un rattachement). */
export function quantiteSignee(mouvement) {
  const sens = TYPES_MOUVEMENT[mouvement.type]?.sens ?? 1
  if (sens === 0) return mouvement.quantite ? `⇄ ${formaterNombre(mouvement.quantite)}` : '0'
  return `${sens > 0 ? '+' : '−'}${formaterNombre(mouvement.quantite)}`
}

/** FICHE DE STOCK (PDF) d'un médicament sur une période. */
export function ficheStockPdf(fiche, du, au) {
  const m = fiche.medicament
  const periode = du || au ? `du ${du ? formaterDate(du) : '…'} au ${au ? formaterDate(au) : '…'}` : 'Depuis le début'
  return exporterDocumentPdf({
    titre: 'FICHE DE STOCK',
    numero: m.code,
    statut: periode,
    encadres: [
      {
        titre: 'Médicament',
        lignes: [
          ['Désignation', m.designation],
          ['Forme / dosage', [m.forme?.libelle, m.dosage].filter(Boolean).join(' · ')],
          ['Famille', m.famille?.libelle],
          ['Unité de comptage', m.uniteVente?.libelle],
          ['CMM', formaterNombre(m.cmm || 0)],
          ['Seuil d\'alerte', formaterNombre(m.seuilAlerte)],
        ],
      },
      {
        titre: 'Mouvements de la période',
        lignes: [
          ['Stock au début', formaterNombre(fiche.stockInitial)],
          ['Total entrées', `+${formaterNombre(fiche.entrees)}`],
          ['Total sorties', `−${formaterNombre(fiche.sorties)}`],
          ['Stock en fin', formaterNombre(fiche.stockFinal)],
          ['Stock actuel', formaterNombre(fiche.stockActuel)],
        ],
      },
    ],
    colonnes: [
      { titre: 'Date', valeur: (mv) => formaterDate(mv.dateMouvement), largeur: 20 },
      { titre: 'Mouvement', valeur: (mv) => TYPES_MOUVEMENT[mv.type]?.libelle || mv.type, largeur: 30 },
      { titre: 'Pièce', valeur: (mv) => mv.pieceRef || '', largeur: 26 },
      { titre: 'Lot', valeur: (mv) => mv.lot?.numeroLot || '', largeur: 20 },
      { titre: 'Motif', valeur: (mv) => mv.motif || '' },
      { titre: 'Entrée', valeur: (mv) => (TYPES_MOUVEMENT[mv.type]?.sens > 0 ? formaterNombre(mv.quantite) : ''), droite: true, largeur: 16 },
      { titre: 'Sortie', valeur: (mv) => (TYPES_MOUVEMENT[mv.type]?.sens < 0 ? formaterNombre(mv.quantite) : ''), droite: true, largeur: 16 },
      { titre: 'Solde', valeur: (mv) => formaterNombre(mv.stockApres), droite: true, largeur: 16 },
    ],
    lignes: fiche.mouvements,
    total: { libelle: 'STOCK EN FIN DE PÉRIODE', valeur: formaterNombre(fiche.stockFinal) },
    signatures: [{ libelle: 'Le gestionnaire du dépôt', nom: nomUtilisateurConnecte() }],
    nomFichier: `fiche_stock_${m.code}`,
  })
}

/** FICHE D'INVENTAIRE (PDF) : lots comptés sur une période, avec le résumé. */
export function ficheInventairePdf(fiche, du, au) {
  const r = fiche.resume
  const periode = !au || du === au ? `Inventaire du ${formaterDate(du)}` : `Inventaire du ${formaterDate(du)} au ${formaterDate(au)}`
  return exporterDocumentPdf({
    titre: "FICHE D'INVENTAIRE",
    numero: (du || '').replaceAll('-', ''),
    statut: periode,
    encadres: [
      {
        titre: 'Résultat du comptage',
        lignes: [
          ['Lots comptés', r.lotsComptes],
          ['Conformes', r.lotsConformes],
          ['Avec écart', r.lotsAvecEcart],
        ],
      },
      {
        titre: 'Écarts',
        lignes: [
          ['Manquants', formaterNombre(r.manquants)],
          ['Excédents', `+${formaterNombre(r.excedents)}`],
          ['Valeur des écarts', formaterMontant(r.valeurEcarts)],
          ['Réalisé par', r.agents.join(', ')],
        ],
      },
    ],
    colonnes: [
      { titre: 'N°', valeur: (l) => fiche.lignes.indexOf(l) + 1, largeur: 8 },
      { titre: 'Médicament', valeur: (l) => `${l.code} — ${l.medicament}` },
      { titre: 'Lot', valeur: (l) => l.lot, largeur: 20 },
      { titre: 'Péremption', valeur: (l) => (l.peremption ? formaterDate(l.peremption) : '—'), largeur: 24 },
      { titre: 'Théorique', valeur: (l) => formaterNombre(l.stockAvant), droite: true, largeur: 22 },
      { titre: 'Compté', valeur: (l) => formaterNombre(l.stockApres), droite: true, largeur: 17 },
      { titre: 'Écart', valeur: (l) => (l.ecart > 0 ? `+${l.ecart}` : String(l.ecart)), droite: true, largeur: 14 },
      { titre: "Valeur de l'écart", valeur: (l) => formaterMontant(l.valeurEcart), droite: true, largeur: 30 },
    ],
    lignes: fiche.lignes,
    total: { libelle: 'TOTAL DES ÉCARTS', valeur: formaterMontant(r.valeurEcarts) },
    signatures: [
      { libelle: 'Les agents de comptage', nom: r.agents.join(', ') },
      { libelle: 'Le gestionnaire du dépôt', nom: nomUtilisateurConnecte() },
      { libelle: 'Le responsable du district', district: true },
    ],
    nomFichier: `fiche_inventaire_${du}${au && au !== du ? '_' + au : ''}`,
  })
}
